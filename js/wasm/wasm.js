/*
 * Copyright 2020 WebAssembly Community Group participants
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function sleep(ms) {
  return new Promise((resolve, _) => setTimeout(resolve, ms));
}

function readStr(u8, o, len = -1) {
  let str = '';
  let end = u8.length;
  if (len != -1)
    end = o + len;
  for (let i = o; i < end && u8[i] != 0; ++i)
    str += String.fromCharCode(u8[i]);
  return str;
}

function debounceLazy(f, ms) {
  let waiting = 0;
  let running = false;

  const wait = async () => {
    ++waiting;
    await sleep(ms);
    return --waiting === 0;
  };

  const wrapped = async (...args) => {
    if (await wait()) {
      while (running) await wait();
      running = true;
      try {
        await f(...args);
      } finally {
        running = false;
      }
    }
  };
  return wrapped;
}

const API = (function() {

class ProcExit extends Error {
  constructor(code) {
    super(`process exited with code ${code}.`);
    this.code = code;
  }
};

class NotImplemented extends Error {
  constructor(modname, fieldname) {
    super(`${modname}.${fieldname} not implemented.`);
  }
}

class AbortError extends Error {
  constructor(msg = 'abort') { super(msg); }
}

class AssertError extends Error {
  constructor(msg) { super(msg); }
}

function assert(cond) {
  if (!cond) {
    throw new AssertError('assertion failed.');
  }
}

function getInstance(module, imports) {
  return WebAssembly.instantiate(module, imports);
}

function getImportObject(obj, names) {
  const result = {};
  for (let name of names) {
    result[name] = obj[name].bind(obj);
  }
  return result;
}

function msToSec(start, end) {
  return ((end - start) / 1000).toFixed(2);
}

const ESUCCESS = 0;

class Memory {
  constructor(memory) {
    this.memory = memory;
    this.buffer = this.memory.buffer;
    this.u8 = new Uint8Array(this.buffer);
    this.u32 = new Uint32Array(this.buffer);
  }

  check() {
    if (this.buffer.byteLength === 0) {
      this.buffer = this.memory.buffer;
      this.u8 = new Uint8Array(this.buffer);
      this.u32 = new Uint32Array(this.buffer);
    }
  }

  read8(o) { return this.u8[o]; }
  read32(o) { return this.u32[o >> 2]; }
  write8(o, v) { this.u8[o] = v; }
  write32(o, v) { this.u32[o >> 2] = v; }
  write64(o, vlo, vhi = 0) { this.write32(o, vlo); this.write32(o + 4, vhi); }

  readStr(o, len) {
    return readStr(this.u8, o, len);
  }

  // Null-terminated string.
  writeStr(o, str) {
    o += this.write(o, str);
    this.write8(o, 0);
    return str.length + 1;
  }

  write(o, buf) {
    if (buf instanceof ArrayBuffer) {
      return this.write(o, new Uint8Array(buf));
    } else if (typeof buf === 'string') {
      return this.write(o, buf.split('').map(x => x.charCodeAt(0)));
    } else {
      const dst = new Uint8Array(this.buffer, o, buf.length);
      dst.set(buf);
      return buf.length;
    }
  }
};

class MemFS {
  constructor(options) {
    const compileStreaming = options.compileStreaming;
    this.hostWrite = options.hostWrite;
    this.stdinStr = options.stdinStr || "";
    this.stdinStrPos = 0;
    this.memfsFilename = options.memfsFilename;

    this.hostMem_ = null;  // Set later when wired up to application.

    // Imports for memfs module.
    const env = getImportObject(
        this, [ 'abort', 'host_write', 'host_read', 'memfs_log', 'copy_in', 'copy_out' ]);

    this.ready = compileStreaming(this.memfsFilename)
                     .then(module => WebAssembly.instantiate(module, {env}))
                     .then(instance => {
                       this.instance = instance;
                       this.exports = instance.exports;
                       this.mem = new Memory(this.exports.memory);
                       this.exports.init();
                     })
  }

  set hostMem(mem) {
    this.hostMem_ = mem;
  }

  setStdinStr(str) {
    this.stdinStr = str;
    this.stdinStrPos = 0;
  }

  addDirectory(path) {
    this.mem.check();
    this.mem.write(this.exports.GetPathBuf(), path);
    this.exports.AddDirectoryNode(path.length);
  }

  addFile(path, contents) {
    const length = contents instanceof ArrayBuffer ? contents.byteLength : contents.length;
    this.mem.check();
    this.mem.write(this.exports.GetPathBuf(), path);
    const inode = this.exports.AddFileNode(path.length, length);
    const addr = this.exports.GetFileNodeAddress(inode);
    this.mem.check();
    this.mem.write(addr, contents);
  }

  getFileContents(path) {
    this.mem.check();
    this.mem.write(this.exports.GetPathBuf(), path);
    const inode = this.exports.FindNode(path.length);
    const addr = this.exports.GetFileNodeAddress(inode);
    const size = this.exports.GetFileNodeSize(inode);
    return new Uint8Array(this.mem.buffer, addr, size);
  }

  abort() { throw new AbortError(); }

  host_write(fd, iovs, iovs_len, nwritten_out) {
    this.hostMem_.check();
    assert(fd <= 2);
    let size = 0;
    let str = '';
    for (let i = 0; i < iovs_len; ++i) {
      const buf = this.hostMem_.read32(iovs);
      iovs += 4;
      const len = this.hostMem_.read32(iovs);
      iovs += 4;
      str += this.hostMem_.readStr(buf, len);
      size += len;
    }
    this.hostMem_.write32(nwritten_out, size);
    this.hostWrite(str);
    return ESUCCESS;
  }

  host_read(fd, iovs, iovs_len, nread) {
    this.hostMem_.check();
    assert(fd === 0);
    let size = 0;
    for (let i = 0; i < iovs_len; ++i) {
      const buf = this.hostMem_.read32(iovs);
      iovs += 4;
      const len = this.hostMem_.read32(iovs);
      iovs += 4;
      const lenToWrite = Math.min(len, (this.stdinStr.length - this.stdinStrPos));
      if(lenToWrite === 0){
        break;
      }
      this.hostMem_.write(buf, this.stdinStr.substr(this.stdinStrPos, lenToWrite));
      size += lenToWrite;
      this.stdinStrPos += lenToWrite;
      if(lenToWrite !== len){
        break;
      }
    }
    // For logging
    // this.hostWrite("Read "+ size + "bytes, pos: "+ this.stdinStrPos + "\n");
    this.hostMem_.write32(nread, size);
    return ESUCCESS;
  }

  memfs_log(buf, len) {
    this.mem.check();
    console.log(this.mem.readStr(buf, len));
  }

  copy_out(clang_dst, memfs_src, size) {
    this.hostMem_.check();
    const dst = new Uint8Array(this.hostMem_.buffer, clang_dst, size);
    this.mem.check();
    const src = new Uint8Array(this.mem.buffer, memfs_src, size);
    // console.log(`copy_out(${clang_dst.toString(16)}, ${memfs_src.toString(16)}, ${size})`);
    dst.set(src);
  }

  copy_in(memfs_dst, clang_src, size) {
    this.mem.check();
    const dst = new Uint8Array(this.mem.buffer, memfs_dst, size);
    this.hostMem_.check();
    const src = new Uint8Array(this.hostMem_.buffer, clang_src, size);
    // console.log(`copy_in(${memfs_dst.toString(16)}, ${clang_src.toString(16)}, ${size})`);
    dst.set(src);
  }
}

const RAF_PROC_EXIT_CODE = 0xC0C0A;

class App {
  constructor(module, memfs, name, ...args) {
    this.argv = [name, ...args];
    this.environ = {USER : 'alice'};
    this.memfs = memfs;
    this.allowRequestAnimationFrame = true;
    this.handles = new Map();
    this.nextHandle = 0;
    this.canvas = '';
    this.ctx2d = '';

    const env = getImportObject(this, [
      'canvas_arc',
      'canvas_arcTo',
      'canvas_beginPath',
      'canvas_bezierCurveTo',
      'canvas_clearRect',
      'canvas_clip',
      'canvas_closePath',
      'canvas_createImageData',
      'canvas_destroyHandle',
      'canvas_ellipse',
      'canvas_fill',
      'canvas_fillRect',
      'canvas_fillText',
      'canvas_imageDataSetData',
      'canvas_lineTo',
      'canvas_measureText',
      'canvas_moveTo',
      'canvas_putImageData',
      'canvas_quadraticCurveTo',
      'canvas_rect',
      'canvas_requestAnimationFrame',
      'canvas_restore',
      'canvas_rotate',
      'canvas_save',
      'canvas_scale',
      'canvas_setFillStyle',
      'canvas_setFont',
      'canvas_setGlobalAlpha',
      'canvas_setHeight',
      'canvas_setLineCap',
      'canvas_setLineDashOffset',
      'canvas_setLineJoin',
      'canvas_setLineWidth',
      'canvas_setMiterLimit',
      'canvas_setShadowBlur',
      'canvas_setShadowColor',
      'canvas_setShadowOffsetX',
      'canvas_setShadowOffsetY',
      'canvas_setStrokeStyle',
      'canvas_setTextAlign',
      'canvas_setTextBaseline',
      'canvas_setTransform',
      'canvas_setWidth',
      'canvas_stroke',
      'canvas_strokeRect',
      'canvas_strokeText',
      'canvas_transform',
      'canvas_translate',

      'input_setMousePosition',
    ]);

    const wasi_unstable = getImportObject(this, [
      'proc_exit', 'environ_sizes_get', 'environ_get', 'args_sizes_get',
      'args_get', 'random_get', 'clock_time_get', 'poll_oneoff'
    ]);

    // Fill in some WASI implementations from memfs.
    Object.assign(wasi_unstable, this.memfs.exports);

    this.ready = getInstance(module, {wasi_unstable, env}).then(instance => {
      this.instance = instance;
      this.exports = this.instance.exports;
      this.mem = new Memory(this.exports.memory);
      this.memfs.hostMem = this.mem;
    });
  }

  setCanvas(c){
      this.canvas = c;
      this.ctx2d = this.canvas.getContext('2d');
  }

  async run() {
    await this.ready;
    try {
      this.exports._start();
    } catch (exn) {
      let writeStack = true;
      if (exn instanceof ProcExit) {
        if (exn.code === RAF_PROC_EXIT_CODE) {
        //   console.log('Allowing rAF after exit.');
          return true;
        }
        // Don't allow rAF unless you return the right code.
        // console.log(`Disallowing rAF since exit code is ${exn.code}.`);
        this.allowRequestAnimationFrame = false;
        if (exn.code == 0) {
          return false;
        }
        writeStack = false;
      }

      // Write error message.
      let msg = `Error: ${exn.message}`;
      if (writeStack) {
        msg = msg + `\n${exn.stack}`;
      }
      msg += '\n';
      this.memfs.hostWrite(msg);

      // Propagate error.
      throw exn;
    }
  }

  proc_exit(code) {
    throw new ProcExit(code);
  }

  environ_sizes_get(environ_count_out, environ_buf_size_out) {
    this.mem.check();
    let size = 0;
    const names = Object.getOwnPropertyNames(this.environ);
    for (const name of names) {
      const value = this.environ[name];
      // +2 to account for = and \0 in "name=value\0".
      size += name.length + value.length + 2;
    }
    this.mem.write64(environ_count_out, names.length);
    this.mem.write64(environ_buf_size_out, size);
    return ESUCCESS;
  }

  environ_get(environ_ptrs, environ_buf) {
    this.mem.check();
    const names = Object.getOwnPropertyNames(this.environ);
    for (const name of names) {
      this.mem.write32(environ_ptrs, environ_buf);
      environ_ptrs += 4;
      environ_buf +=
          this.mem.writeStr(environ_buf, `${name}=${this.environ[name]}`);
    }
    this.mem.write32(environ_ptrs, 0);
    return ESUCCESS;
  }

  args_sizes_get(argc_out, argv_buf_size_out) {
    this.mem.check();
    let size = 0;
    for (let arg of this.argv) {
      size += arg.length + 1;  // "arg\0".
    }
    this.mem.write64(argc_out, this.argv.length);
    this.mem.write64(argv_buf_size_out, size);
    return ESUCCESS;
  }

  args_get(argv_ptrs, argv_buf) {
    this.mem.check();
    for (let arg of this.argv) {
      this.mem.write32(argv_ptrs, argv_buf);
      argv_ptrs += 4;
      argv_buf += this.mem.writeStr(argv_buf, arg);
    }
    this.mem.write32(argv_ptrs, 0);
    return ESUCCESS;
  }

  random_get(buf, buf_len) {
    const data = new Uint8Array(this.mem.buffer, buf, buf_len);
    for (let i = 0; i < buf_len; ++i) {
      data[i] = (Math.random() * 256) | 0;
    }
  }

  clock_time_get(clock_id, precision, time_out) {
    throw new NotImplemented('wasi_unstable', 'clock_time_get');
  }

  poll_oneoff(in_ptr, out_ptr, nsubscriptions, nevents_out) {
    throw new NotImplemented('wasi_unstable', 'poll_oneoff');
  }

  canvas_destroyHandle(handle) {
    this.handles.delete(handle);
  }

  // Canvas API
  canvas_setWidth(width) { if (this.canvas) this.canvas.width = width; }
  canvas_setHeight(height) { if (this.canvas) this.canvas.height = height; }
  canvas_requestAnimationFrame() {
    if (this.allowRequestAnimationFrame) {
      requestAnimationFrame(ms => {
        if (this.allowRequestAnimationFrame) {
          this.exports.canvas_loop(ms);
        }
      });
    }
  }

  // ImageData stuff
  canvas_createImageData(w, h) {
    if (this.ctx2d) {
      const imageData = this.ctx2d.createImageData(w, h);
      const handle = this.nextHandle++;
      this.handles.set(handle, imageData);
      return handle;
    }
    return -1;
  }
  canvas_putImageData(handle, x, y) {
    if (this.ctx2d) {
      const imageData = this.handles.get(handle);
      if (imageData) {
        this.ctx2d.putImageData(imageData, x, y);
      }
    }
  }
  canvas_imageDataSetData(handle, buffer, offset, size) {
    const imageData = this.handles.get(handle);
    if (imageData) {
      this.mem.check();
      const src = new Uint8Array(this.mem.buffer, buffer, size);
      imageData.data.set(src, offset);
    }
  }

  // Other Canvas methods.
  canvas_arc(...args) { if (this.ctx2d) this.ctx2d.arc(...args); }
  canvas_arcTo(...args) { if (this.ctx2d) this.ctx2d.arcTo(...args); }
  canvas_beginPath(...args) { if (this.ctx2d) this.ctx2d.beginPath(...args); }
  canvas_bezierCurveTo(...args) { if (this.ctx2d) this.ctx2d.bezierCurveTo(...args); }
  canvas_clearRect(...args) { if (this.ctx2d) this.ctx2d.clearRect(...args); }
  canvas_clip(value) { if (this.ctx2d) this.ctx2d.clip(['nonzero', 'evenodd'][value]); }
  canvas_closePath(...args) { if (this.ctx2d) this.ctx2d.closePath(...args); }
  canvas_ellipse(...args) { if (this.ctx2d) this.ctx2d.ellipse(...args); }
  canvas_fill(value) { if (this.ctx2d) this.ctx2d.fill(['nonzero', 'evenodd'][value]); }
  canvas_fillRect(...args) { if (this.ctx2d) this.ctx2d.fillRect(...args); }
  canvas_fillText(text, text_len, x, y) {  // TODO: maxwidth
    this.mem.check();
    if (this.ctx2d) this.ctx2d.fillText(this.mem.readStr(text, text_len), x, y);
  }
  canvas_lineTo(...args) { if (this.ctx2d) this.ctx2d.lineTo(...args); }
  canvas_measureText(text, text_len) {
    this.mem.check();
    if (this.ctx2d) return this.ctx2d.measureText(this.mem.readStr(text, text_len)).width;
    return 0;
  }
  canvas_moveTo(...args) { if (this.ctx2d) this.ctx2d.moveTo(...args); }
  canvas_quadraticCurveTo(...args) { if (this.ctx2d) this.ctx2d.quadraticCurveTo(...args); }
  canvas_rect(...args) { if (this.ctx2d) this.ctx2d.rect(...args); }
  canvas_restore(...args) { if (this.ctx2d) this.ctx2d.restore(...args); }
  canvas_rotate(...args) { if (this.ctx2d) this.ctx2d.rotate(...args); }
  canvas_save(...args) { if (this.ctx2d) this.ctx2d.save(...args); }
  canvas_scale(...args) { if (this.ctx2d) this.ctx2d.scale(...args); }
  canvas_setTransform(...args) { if (this.ctx2d) this.ctx2d.setTransform(...args); }
  canvas_stroke(...args) { if (this.ctx2d) this.ctx2d.stroke(...args); }
  canvas_strokeRect(...args) { if (this.ctx2d) this.ctx2d.strokeRect(...args); }
  canvas_strokeText(text, text_len, x, y) {  // TODO: maxwidth
    this.mem.check();
    if (this.ctx2d) this.ctx2d.strokeText(this.mem.readStr(text, text_len), x, y);
  }
  canvas_transform(...args) { if (this.ctx2d) this.ctx2d.transform(...args); }
  canvas_translate(...args) { if (this.ctx2d) this.ctx2d.translate(...args); }

  // Canvas properties.
  canvas_setFillStyle(buf, len) {
    this.mem.check();
    if (this.ctx2d) this.ctx2d.fillStyle = this.mem.readStr(buf, len);
  }
  canvas_setFont(buf, len) {
    this.mem.check();
    if (this.ctx2d) this.ctx2d.font = this.mem.readStr(buf, len);
  }
  canvas_setGlobalAlpha(value) { if (this.ctx2d) this.ctx2d.globalAlpha = value; }
  canvas_setLineCap(value) {
    if (this.ctx2d) this.ctx2d.lineCap = ['butt', 'round', 'square'][value];
  }
  canvas_setLineDashOffset(value) { if (this.ctx2d) this.ctx2d.lineDashOffset = value; }
  canvas_setLineJoin(value) {
    if (this.ctx2d) this.ctx2d.lineJoin = ['bevel', 'round', 'miter'][value];
  }
  canvas_setLineWidth(value) { if (this.ctx2d) this.ctx2d.lineWidth = value; }
  canvas_setMiterLimit(value) { if (this.ctx2d) this.ctx2d.miterLimit = value; }
  canvas_setShadowBlur(value) { if (this.ctx2d) this.ctx2d.shadowBlur = value; }
  canvas_setShadowColor(buf, len) {
    this.mem.check();
    if (this.ctx2d) this.ctx2d.shadowColor = this.mem.readStr(buf, len);
  }
  canvas_setShadowOffsetX(value) { if (this.ctx2d) this.ctx2d.setShadowOffsetX = value; }
  canvas_setShadowOffsetY(value) { if (this.ctx2d) this.ctx2d.setShadowOffsetY = value; }
  canvas_setStrokeStyle(buf, len) {
    this.mem.check();
    if (this.ctx2d) this.ctx2d.strokeStyle = this.mem.readStr(buf, len);
  }
  canvas_setTextAlign(value) {
    if (this.ctx2d)
      this.ctx2d.textAlign = ['left', 'right', 'center', 'start', 'end'][value];
  }
  canvas_setTextBaseline(value) {
    if (this.ctx2d)
      this.ctx2d.textBaseline = [
        'top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom'
      ][value];
  }

    // Input API
    input_setMousePosition(x, y) {
        try { this.exports.input_setMousePosition(x, y); }
        catch(err) {}
    }
}

class Tar {
  constructor(buffer) {
    this.u8 = new Uint8Array(buffer);
    this.offset = 0;
  }

  readStr(len) {
    const result = readStr(this.u8, this.offset, len);
    this.offset += len;
    return result;
  }

  readOctal(len) {
    return parseInt(this.readStr(len), 8);
  }

  alignUp() {
    this.offset = (this.offset + 511) & ~511;
  }

  readEntry() {
    if (this.offset + 512 > this.u8.length) {
      return null;
    }

    const entry = {
      filename : this.readStr(100),
      mode : this.readOctal(8),
      owner : this.readOctal(8),
      group : this.readOctal(8),
      size : this.readOctal(12),
      mtim : this.readOctal(12),
      checksum : this.readOctal(8),
      type : this.readStr(1),
      linkname : this.readStr(100),
    };

    if (this.readStr(8) !== 'ustar  ') {
      return null;
    }

    entry.ownerName = this.readStr(32);
    entry.groupName = this.readStr(32);
    entry.devMajor = this.readStr(8);
    entry.devMinor = this.readStr(8);
    entry.filenamePrefix = this.readStr(155);
    this.alignUp();

    if (entry.type === '0') {        // Regular file.
      entry.contents = this.u8.subarray(this.offset, this.offset + entry.size);
      this.offset += entry.size;
      this.alignUp();
    } else if (entry.type !== '5') { // Directory.
      console.log('type', entry.type);
      assert(false);
    }
    return entry;
  }

  untar(memfs) {
    let entry;
    while (entry = this.readEntry()) {
      switch (entry.type) {
      case '0': // Regular file.
        memfs.addFile(entry.filename, entry.contents);
        break;
      case '5':
        memfs.addDirectory(entry.filename);
        break;
      }
    }
  }
}

class API {
  constructor(options) {
    this.readBuffer = options.readBuffer;
    this.compileStreaming = options.compileStreaming;
    this.hostWrite = options.hostWrite;
    this.clangFilename = options.clang || 'clang';
    this.lldFilename = options.lld || 'lld';
    this.sysrootFilename = options.sysroot || 'sysroot.tar';
    this.showTiming = options.showTiming || false;
    this.preElement = '';
    this.canvas = '';

    this.clangCommonArgs = [
      '-disable-free',
      '-isysroot', '/',
      '-internal-isystem', '/include/c++/v1',
      '-internal-isystem', '/include',
      '-internal-isystem', '/lib/clang/8.0.1/include',
      '-ferror-limit', '19',
      '-fmessage-length', '80',
    ];

    this.memfs = new MemFS({
      compileStreaming : this.compileStreaming,
      hostWrite : this.hostWrite,
      memfsFilename : options.memfs || 'memfs',
    });
    this.ready = this.memfs.ready
    .then(() => { 
        return this.untar(this.memfs, this.sysrootFilename);
    }).then(() => {
        return Promise.all([
            this.addExternalFile("/cpp/Input.h"),
            this.addExternalFile("/cpp/VectorMath.h"),
            this.addExternalFile("/cpp/Drawing.h"),
        ]);
    });
  }

  hostLog(message) {
    this.hostWrite(`${message}`);
  }

  async hostLogAsync(message, promise) {
    const start = +new Date();
    this.hostLog(`${message}`);
    const result = await promise;
    const end = +new Date();
    if (this.showTiming) {
      this.hostWrite('\ndone. (${msToSec(start, end)}s)');
    }
    this.hostWrite('\n');
    return result;
  }

  async getModule(name) {
    return await this.hostLogAsync(`Fetching and compiling ${name}`, this.compileStreaming(name));
  }

  async untar(memfs, filename) {
    await this.memfs.ready;
    const promise = (async () => {
      const tar = new Tar(await this.readBuffer(filename));
      tar.untar(this.memfs);
    })();
    // await this.hostLogAsync(`Untarring ${filename}`, promise);
    return await promise;
  }

  async addExternalFile(filename) {
    await this.memfs.ready;
    var text = await loadFile(filename);
    const promise = (async () => {
        var localInclude = "include" + filename.substring(filename.lastIndexOf('/'));
        this.memfs.addFile(localInclude, text);
    })();
    // await this.hostLogAsync(`Adding external include: ${filename}`, promise);
    return await promise;
  }

  async compile(options) {
    const input = options.input;
    const contents = options.contents;
    const obj = options.obj;
    const opt = options.opt || '2';

    await this.ready;
    this.memfs.addFile(input, contents);
    const clang = await this.getModule(this.clangFilename);
    return await this.run(clang, 'clang', '-cc1', '-emit-obj',
                          ...this.clangCommonArgs, '-O2', '-o', obj, '-x',
                          'c++', input);
  }

  async compileToAssembly(options) {
    const input = options.input;
    const output = options.output;
    const contents = options.contents;
    const obj = options.obj;
    const triple = options.triple || 'x86_64';
    const opt = options.opt || '2';

    await this.ready;
    this.memfs.addFile(input, contents);
    const clang = await this.getModule(this.clangFilename);
    await this.run(clang, 'clang', '-cc1', '-S', ...this.clangCommonArgs,
                          `-triple=${triple}`, '-mllvm',
                          '--x86-asm-syntax=intel', `-O${opt}`,
                          '-o', output, '-x', 'c++', input);
    return this.memfs.getFileContents(output);
  }

  async compileTo6502(options) {
    const input = options.input;
    const output = options.output;
    const contents = options.contents;
    const flags = options.flags;

    await this.ready;
    this.memfs.addFile(input, contents);
    const vasm = await this.getModule('vasm6502_oldstyle');
    await this.run(vasm, 'vasm6502_oldstyle', ...flags, '-o', output, input);
    return this.memfs.getFileContents(output);
  }

  async link(obj, wasm) {
    const stackSize = 1024 * 1024;

    const libdir = 'lib/wasm32-wasi';
    const crt1 = `${libdir}/crt1.o`;
    await this.ready;
    const lld = await this.getModule(this.lldFilename);
    return await this.run(
        lld, 'wasm-ld', '--no-threads',
        '--export-dynamic',  // TODO required?
        '-z', `stack-size=${stackSize}`, `-L${libdir}`, crt1, obj, '-lc',
        '-lc++', '-lc++abi', '-lcanvas', '-o', wasm)
  }

  async run(module, ...args) {
    const app = new App(module, this.memfs, ...args);
    app.setCanvas(this.canvas);
    this.attachInput(app);
    const stillRunning = await app.run();
    return stillRunning ? app : null;
  }

  async compileLinkRun(contents) {
    const input = `test.cc`;
    const obj = `test.o`;
    const wasm = `test.wasm`;
    await this.compile({input, contents, obj});
    await this.link(obj, wasm);

    const buffer = this.memfs.getFileContents(wasm);
    const testMod = await this.hostLogAsync(`Compiling code`, WebAssembly.compile(buffer));
    return await this.hostLogAsync(`Running code\n`, this.run(testMod, wasm));
  }

    setPre(elementName)
    {
        this.preElement = elementName;
        this.memfs.preElement = elementName;
    }

    setCanvas(elementName)
    {
        this.canvas = document.getElementById(elementName);
    }

    attachInput(app)
    {
        if (this.canvas != null)
        {
            this.canvas.addEventListener("mousemove", function(e) { 
                var cRect = this.getBoundingClientRect();
                var canvasX = Math.round(e.clientX - cRect.left);
                var canvasY = Math.round(e.clientY - cRect.top);
                app.input_setMousePosition(canvasX, canvasY);
            });
        }
    }
}

return API;

})();

// Global buffer cache
bufferCache = {};
compileCache = {};
bufferLock = {};
compileLock = {};

const apiOptions = 
{
    async readBuffer(filename) 
    {
        if (bufferCache[filename]) return bufferCache[filename];
        if (bufferLock[filename])
        {
            await bufferLock[filename].promise;
            return apiOptions.readBuffer(filename);
        }
        bufferLock[filename] = new AsyncLock();
        bufferLock[filename].enable();

        // Fetch from github
        // const response = await fetch('https://raw.githubusercontent.com/binji/wasm-clang/master/'+filename, { credentials: 'omit' });
        // const response = await fetch('https://rawcdn.githack.com/RobbinMarcus/ClangWasmStorage/9233aedea5565207c991b86b3808c4323f96c33c/'+filename+".wasm", { credentials: 'omit' });
        var url = 'https://rawcdn.githack.com/RobbinMarcus/ClangWasmStorage/9233aedea5565207c991b86b3808c4323f96c33c/'+filename;

        // Fetch locally for fast iteration
        // var url = '/static/wasm/'+filename;
        const response = await loadCached(url);

        const buffer = await response.arrayBuffer();
        bufferCache[filename] = buffer;
        bufferLock[filename].disable();
        return buffer;
    },
  
    async compileStreaming(filename) 
    {
        if (compileCache[filename]) return compileCache[filename];
        if (compileLock[filename])
        {
            await compileLock[filename].promise;
            return apiOptions.compileStreaming(filename);
        }
        compileLock[filename] = new AsyncLock();
        compileLock[filename].enable();

        // const response = await apiOptions.readBuffer(filename);
        // const response = await fetch('https://raw.githubusercontent.com/robbinmarcus/clangwasmstorage/master/'+filename+".wasm", { credentials: 'omit', });
        // const module = await WebAssembly.compile(response);
        const module = await WebAssembly.compileStreaming(fetch('https://rawcdn.githack.com/RobbinMarcus/ClangWasmStorage/9233aedea5565207c991b86b3808c4323f96c33c/'+filename+".wasm"));

        // Fetch locally for fast iteration
        // var localUrl = '/static/wasm/'+filename+".wasm";
        // const response = await fetch(localUrl);
       
        compileCache[filename] = module;
        compileLock[filename].disable();
        return module;
    },
  
    hostWrite(s) 
    { 
        if (this.preElement != '')
        {
            var outputPre = document.getElementById(this.preElement); 
            outputPre.innerHTML += s;
        }
        else
        {
            console.log(s);
        }
    }
};

// var api = new API(apiOptions);
