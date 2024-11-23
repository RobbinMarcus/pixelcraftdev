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

function createEditor(textAreaId, editorMode="python")
{
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

    var button = document.getElementById(textAreaId + "button");
    button.addEventListener("click", function(){ runEditor(editor) });

    // Store editor
    codeEditors.set(textAreaId, editor);
    if (editorMode != "python")
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
    // Update text area contents
    editor.save();

    var textAreaId = editor.getOption("textArea");
    var canvasDiv = textAreaId + 'div'
    var canvasName = textAreaId + 'canvas';
    var outputName = textAreaId + 'output';

    document.getElementById(canvasDiv);

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
    else
    {
        var api = wasmApis.get(textAreaId);
        application = api.compileLinkRun(code);
    }
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
