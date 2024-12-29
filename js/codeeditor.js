CodeMirror.defineOption("textArea", "None", null);

var loadedFiles = new Map();
var codeEditors = new Map();
var wasmApis = new Map();

var keymap = {
    "Ctrl-Enter" : function (editor) 
    {
        runEditor(editor);
    }
}

function outf(text) 
{ 
    var mypre = document.getElementById(Sk.pre);
    mypre.innerHTML = mypre.innerHTML + text; 
} 

async function loadFile(filename) 
{
    if (loadedFiles.has(filename))
        return loadedFiles.get(filename);

    var response = await loadCached(filename);
    var text = await response.text();
    loadedFiles.set(filename, text);

    return text;
}

function builtinRead(x) 
{
    if (x.startsWith("./"))
    {
        var url = "/static/"
        if (x.endsWith(".py"))
            url += "python/"
        url += x.substring(2);

        if (loadedFiles.has(url))
            return loadedFiles.get(url);
    }

    if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined)
            throw "File not found: '" + x + "'";
    return Sk.builtinFiles["files"][x];
}

function createEditor(type, id, editorMode="python")
{
    var textAreaId = type + id;
    var myTextarea = document.getElementById(textAreaId);
    var editor = CodeMirror.fromTextArea(myTextarea, 
    {
        lineNumbers: true,
        mode: editorMode,
        theme: "tokyonight-night",
        extraKeys: keymap,
        indentUnit: 4,
        indentWithTabs: false
    });
    editor.setOption("textArea", textAreaId);
    editor.setOption("type", type);
    editor.setOption("id", id);

    var button = document.getElementById(textAreaId + "button");
    button.addEventListener("click", function(){ runEditor(editor) });

    // Store editor
    codeEditors.set(textAreaId, editor);
    if (editorMode == "text/x-c++src")
    {
        var api = new API(apiOptions);
        var canvasName = textAreaId + 'canvas';
        var outputName = textAreaId + 'output';
        api.setPre(outputName);
        api.setCanvas(canvasName);
        wasmApis.set(textAreaId, api);
    }
    
    return editor;
}

function createEditorReadOnly(textArea, editorMode="python")
{
    var editor = CodeMirror.fromTextArea(textArea, 
    {
        lineNumbers: true,
        mode: editorMode,
        theme: "monokai",
        extraKeys: keymap,
        indentUnit: 4,
        indentWithTabs: false,
        readOnly: "nocursor"
    });

    return editor;
}

function getEditor(textAreaId)
{
    if (codeEditors.has(textAreaId))
        return codeEditors.get(textAreaId);
}

function runEditor(editor)
{
    if (editor.options.mode == "wgsl" || editor.options.mode == "text/javascript")
    {
        runEditorWebgpu(editor);
        return;
    }

    // Update text area contents
    editor.save();

    var textAreaId = editor.getOption("textArea");
    var canvasDiv = textAreaId + 'div'
    var canvasName = textAreaId + 'canvas';
    var outputName = textAreaId + 'output';

    var code = document.getElementById(textAreaId).value; 

    // Clean output
    var outputPre = document.getElementById(outputName);
    $(outputPre).show();
    outputPre.innerHTML = ''; 

    var containsGraphics = code.search("Canvas") > -1 || code.search("processing") > -1;
    if (containsGraphics)
    {
        canvas = document.getElementById(canvasDiv);
        if (canvas != null)
        {
            $(canvas).show();
        }
    }

    if (editor.options.mode == 'python')
    {
        Sk.pre = outputName;
        Sk.canvas = canvasName;
        (Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = canvasDiv;
        Sk.configure(
        { 
            output: outf,
            read: builtinRead,
            __future__: Sk.python3
        }); 
        
        Sk.misceval.asyncToPromise(function() {return Sk.importMainWithBody("__main__", false, code, true);})
        .catch(err => outf(err.toString()));
    }
    else if (editor.options.mode == "text/x-c++src")
    {
        var api = wasmApis.get(textAreaId);
        application = api.compileLinkRun(code);
    }
    else
    {
        throw "Unsupported editor type: " + editor.options.mode;
    }
}

function runEditorWebgpu(editor)
{
    // Update text area contents
    editor.save();

    var type = editor.getOption("type");
    var id = editor.getOption("id");
    var textAreaId = editor.getOption("textArea");
    var canvasDiv = textAreaId + 'div'

    var containsGraphics = true;
    if (containsGraphics)
    {
        canvas = document.getElementById(canvasDiv);
        if (canvas != null)
        {
            $(canvas).show();
        }
    }

    var jsElement = document.getElementById("js" + id);
    if (jsElement)
    {
        if (type == "js")
        {
            // Clean output
            var outputName = textAreaId + 'output';
            var outputPre = document.getElementById(outputName);
            $(outputPre).show();
            outputPre.innerHTML = ''; 
        }

        // Run js code to execute
        var code = jsElement.value; 
        try 
        {
            new Function(code).call(null).call(null, type, id).catch(e => 
            {
                if (type == "js")
                {
                    outputPre.innerHTML += e.message;
                }
            });
        }
        catch (e) 
        {
            outputPre.innerHTML += e.message;
        }
    }
    else
    {
        var vertexShader = null;
        var vertexElement = document.getElementById("vertex" + id);
        if (vertexElement)
        {
            vertexShader = vertexElement.value; 
        }

        var pixelShader = document.getElementById("pixel" + id).value; 

        // Run webgpu with predefined js for fullscreen
        var canvas = document.getElementById(type + id + "canvas");
        runWebgpuPixelShaderOnly(canvas, vertexShader, pixelShader);
    }
}

function runWebgpuPixelShaderOnly(canvas, vertexShaderCode, pixelShaderCode)
{
    // Create default vertex shader if not provided
    if (vertexShaderCode == null)
    {
        vertexShaderCode = `
        @vertex
        fn main(@location(0) pos: vec2f) -> @builtin(position) vec4f 
        {
            return vec4f(pos, 0, 1);
        }
        `
    }

    $(document).ready(async function() 
    {
        if (!navigator.gpu) 
            throw new Error("WebGPU not supported on this browser.");

        // Request an adapter
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) 
            throw new Error("No appropriate GPUAdapter found.");

        // Request a device
        const device = await adapter.requestDevice();

        // Create webgpu canvas context
        const context = canvas.getContext("webgpu");
        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device: device, format: canvasFormat, });

        // Create a vertex buffer with the triangle vertices
        const vertices = new Float32Array([0, 0.75, 0.75, -0.75, -0.75, -0.75]);
        const vertexBuffer = device.createBuffer({
          size: vertices.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        // Upload the vertex data to the GPU
        device.queue.writeBuffer(vertexBuffer, 0, vertices);
        const vertexBufferLayout = {
          arrayStride: 8,
          attributes: [{
            format: "float32x2",
            offset: 0,
            shaderLocation: 0, 
          }],
        };

        // Compile vertex and pixel shaders to modules
        const vertexShaderModule = device.createShaderModule({ code: vertexShaderCode });
        const pixelShaderModule = device.createShaderModule({ code: pixelShaderCode });

        // Create a render pipeline with the vertex and pixel shader modules
        const pipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: vertexShaderModule,
                entryPoint: "main",
                buffers: [vertexBufferLayout]
            },
            fragment: {
                module: pixelShaderModule,
                entryPoint: "main",
                targets: [{ format: canvasFormat }],
            },
        });

        // Create a command encoder and render pass
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: "clear",
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                storeOp: "store",
            }]
        });

        // Draw the triangle using the vertex buffer and render pipeline
        pass.setPipeline(pipeline);
        pass.setVertexBuffer(0, vertexBuffer);
        pass.draw(vertices.length / 2);
        pass.end();

        device.queue.submit([encoder.finish()]);
    });
}


// Refresh editor when changing tabs
$('.nav-tabs a').on('shown.bs.tab', function()
{
    var url = $(this).attr('href');
    url = url.substr(1, url.length - 4);
    var editor = getEditor(url);
    if (editor)
    {
        editor.refresh();
    }
});

// Hide canvas when changing tabs
$('.nav-tabs a').on('hide.bs.tab', function()
{
    var url = $(this).attr('href');
    textAreaId = url.substr(1, url.length - 4);
    var canvasDiv = textAreaId + 'div'
    canvas = document.getElementById(canvasDiv);
    if (canvas != null)
    {
        $(canvas).hide();
    }
});

// Auto create read only editors from all text areas
$(document).ready(function() 
{ 
    $("textarea").each(function() 
    {
        var attr = $(this).attr('type');
        if (attr)
        {
            createEditorReadOnly(this, $(this).attr('type')); 
        }
    }); 
});
