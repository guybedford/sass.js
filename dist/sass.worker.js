var Module;
if (!Module) Module = (typeof Module !== "undefined" ? Module : null) || {};
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key]
  }
}
var ENVIRONMENT_IS_WEB = typeof window === "object";
var ENVIRONMENT_IS_NODE = typeof process === "object" && typeof require === "function" && !ENVIRONMENT_IS_WEB;
var ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
if (ENVIRONMENT_IS_NODE) {
  if (!Module["print"]) Module["print"] = function print(x) {
    process["stdout"].write(x + "\n")
  };
  if (!Module["printErr"]) Module["printErr"] = function printErr(x) {
    process["stderr"].write(x + "\n")
  };
  var nodeFS = require("fs");
  var nodePath = require("path");
  Module["read"] = function read(filename, binary) {
    filename = nodePath["normalize"](filename);
    var ret = nodeFS["readFileSync"](filename);
    if (!ret && filename != nodePath["resolve"](filename)) {
      filename = path.join(__dirname, "..", "src", filename);
      ret = nodeFS["readFileSync"](filename)
    }
    if (ret && !binary) ret = ret.toString();
    return ret
  };
  Module["readBinary"] = function readBinary(filename) {
    return Module["read"](filename, true)
  };
  Module["load"] = function load(f) {
    globalEval(read(f))
  };
  if (!Module["thisProgram"]) {
    if (process["argv"].length > 1) {
      Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/")
    } else {
      Module["thisProgram"] = "unknown-program"
    }
  }
  Module["arguments"] = process["argv"].slice(2);
  if (typeof module !== "undefined") {
    module["exports"] = Module
  }
  process["on"]("uncaughtException", (function(ex) {
    if (!(ex instanceof ExitStatus)) {
      throw ex
    }
  }));
  Module["inspect"] = (function() {
    return "[Emscripten Module object]"
  })
} else if (ENVIRONMENT_IS_SHELL) {
  if (!Module["print"]) Module["print"] = print;
  if (typeof printErr != "undefined") Module["printErr"] = printErr;
  if (typeof read != "undefined") {
    Module["read"] = read
  } else {
    Module["read"] = function read() {
      throw "no read() available (jsc?)"
    }
  }
  Module["readBinary"] = function readBinary(f) {
    if (typeof readbuffer === "function") {
      return new Uint8Array(readbuffer(f))
    }
    var data = read(f, "binary");
    assert(typeof data === "object");
    return data
  };
  if (typeof scriptArgs != "undefined") {
    Module["arguments"] = scriptArgs
  } else if (typeof arguments != "undefined") {
    Module["arguments"] = arguments
  }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module["read"] = function read(url) {
    var xhr = new XMLHttpRequest;
    xhr.open("GET", url, false);
    xhr.send(null);
    return xhr.responseText
  };
  if (typeof arguments != "undefined") {
    Module["arguments"] = arguments
  }
  if (typeof console !== "undefined") {
    if (!Module["print"]) Module["print"] = function print(x) {
      console.log(x)
    };
    if (!Module["printErr"]) Module["printErr"] = function printErr(x) {
      console.log(x)
    }
  } else {
    var TRY_USE_DUMP = false;
    if (!Module["print"]) Module["print"] = TRY_USE_DUMP && typeof dump !== "undefined" ? (function(x) {
      dump(x)
    }) : (function(x) {})
  }
  if (ENVIRONMENT_IS_WORKER) {
    Module["load"] = importScripts
  }
  if (typeof Module["setWindowTitle"] === "undefined") {
    Module["setWindowTitle"] = (function(title) {
      document.title = title
    })
  }
} else {
  throw "Unknown runtime environment. Where are we?"
}

function globalEval(x) {
  eval.call(null, x)
}
if (!Module["load"] && Module["read"]) {
  Module["load"] = function load(f) {
    globalEval(Module["read"](f))
  }
}
if (!Module["print"]) {
  Module["print"] = (function() {})
}
if (!Module["printErr"]) {
  Module["printErr"] = Module["print"]
}
if (!Module["arguments"]) {
  Module["arguments"] = []
}
if (!Module["thisProgram"]) {
  Module["thisProgram"] = "./this.program"
}
Module.print = Module["print"];
Module.printErr = Module["printErr"];
Module["preRun"] = [];
Module["postRun"] = [];
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key]
  }
}
var Runtime = {
  setTempRet0: (function(value) {
    tempRet0 = value
  }),
  getTempRet0: (function() {
    return tempRet0
  }),
  stackSave: (function() {
    return STACKTOP
  }),
  stackRestore: (function(stackTop) {
    STACKTOP = stackTop
  }),
  getNativeTypeSize: (function(type) {
    switch (type) {
      case "i1":
      case "i8":
        return 1;
      case "i16":
        return 2;
      case "i32":
        return 4;
      case "i64":
        return 8;
      case "float":
        return 4;
      case "double":
        return 8;
      default:
        {
          if (type[type.length - 1] === "*") {
            return Runtime.QUANTUM_SIZE
          } else if (type[0] === "i") {
            var bits = parseInt(type.substr(1));
            assert(bits % 8 === 0);
            return bits / 8
          } else {
            return 0
          }
        }
    }
  }),
  getNativeFieldSize: (function(type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE)
  }),
  STACK_ALIGN: 16,
  prepVararg: (function(ptr, type) {
    if (type === "double" || type === "i64") {
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4
      }
    } else {
      assert((ptr & 3) === 0)
    }
    return ptr
  }),
  getAlignSize: (function(type, size, vararg) {
    if (!vararg && (type == "i64" || type == "double")) return 8;
    if (!type) return Math.min(size, 8);
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE)
  }),
  dynCall: (function(sig, ptr, args) {
    if (args && args.length) {
      if (!args.splice) args = Array.prototype.slice.call(args);
      args.splice(0, 0, ptr);
      return Module["dynCall_" + sig].apply(null, args)
    } else {
      return Module["dynCall_" + sig].call(null, ptr)
    }
  }),
  functionPointers: [],
  addFunction: (function(func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2 * (1 + i)
      }
    }
    throw "Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS."
  }),
  removeFunction: (function(index) {
    Runtime.functionPointers[(index - 2) / 2] = null
  }),
  warnOnce: (function(text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text)
    }
  }),
  funcWrappers: {},
  getFuncWrapper: (function(func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {}
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      sigCache[func] = function dynCall_wrapper() {
        return Runtime.dynCall(sig, func, arguments)
      }
    }
    return sigCache[func]
  }),
  getCompilerSetting: (function(name) {
    throw "You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work"
  }),
  stackAlloc: (function(size) {
    var ret = STACKTOP;
    STACKTOP = STACKTOP + size | 0;
    STACKTOP = STACKTOP + 15 & -16;
    return ret
  }),
  staticAlloc: (function(size) {
    var ret = STATICTOP;
    STATICTOP = STATICTOP + size | 0;
    STATICTOP = STATICTOP + 15 & -16;
    return ret
  }),
  dynamicAlloc: (function(size) {
    var ret = DYNAMICTOP;
    DYNAMICTOP = DYNAMICTOP + size | 0;
    DYNAMICTOP = DYNAMICTOP + 15 & -16;
    if (DYNAMICTOP >= TOTAL_MEMORY) {
      var success = enlargeMemory();
      if (!success) {
        DYNAMICTOP = ret;
        return 0
      }
    }
    return ret
  }),
  alignMemory: (function(size, quantum) {
    var ret = size = Math.ceil(size / (quantum ? quantum : 16)) * (quantum ? quantum : 16);
    return ret
  }),
  makeBigInt: (function(low, high, unsigned) {
    var ret = unsigned ? +(low >>> 0) + +(high >>> 0) * +4294967296 : +(low >>> 0) + +(high | 0) * +4294967296;
    return ret
  }),
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
};
Module["Runtime"] = Runtime;
var __THREW__ = 0;
var ABORT = false;
var EXITSTATUS = 0;
var undef = 0;
var tempValue, tempInt, tempBigInt, tempInt2, tempBigInt2, tempPair, tempBigIntI, tempBigIntR, tempBigIntS, tempBigIntP, tempBigIntD, tempDouble, tempFloat;
var tempI64, tempI64b;
var tempRet0, tempRet1, tempRet2, tempRet3, tempRet4, tempRet5, tempRet6, tempRet7, tempRet8, tempRet9;

function assert(condition, text) {
  if (!condition) {
    abort("Assertion failed: " + text)
  }
}
var globalScope = this;

function getCFunc(ident) {
  var func = Module["_" + ident];
  if (!func) {
    try {
      func = eval("_" + ident)
    } catch (e) {}
  }
  assert(func, "Cannot call unknown function " + ident + " (perhaps LLVM optimizations or closure removed it?)");
  return func
}
var cwrap, ccall;
((function() {
  var JSfuncs = {
    "stackSave": (function() {
      Runtime.stackSave()
    }),
    "stackRestore": (function() {
      Runtime.stackRestore()
    }),
    "arrayToC": (function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret
    }),
    "stringToC": (function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) {
        ret = Runtime.stackAlloc((str.length << 2) + 1);
        writeStringToMemory(str, ret)
      }
      return ret
    })
  };
  var toC = {
    "string": JSfuncs["stringToC"],
    "array": JSfuncs["arrayToC"]
  };
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i])
        } else {
          cArgs[i] = args[i]
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if (returnType === "string") ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push((function() {
          Runtime.stackRestore(stack)
        }));
        return
      }
      Runtime.stackRestore(stack)
    }
    return ret
  };
  var sourceRegex = /^function\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;

  function parseJSFunc(jsfunc) {
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {
      arguments: parsed[0],
      body: parsed[1],
      returnValue: parsed[2]
    }
  }
  var JSsource = {};
  for (var fun in JSfuncs) {
    if (JSfuncs.hasOwnProperty(fun)) {
      JSsource[fun] = parseJSFunc(JSfuncs[fun])
    }
  }
  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    var numericArgs = argTypes.every((function(type) {
      return type === "number"
    }));
    var numericRet = returnType !== "string";
    if (numericRet && numericArgs) {
      return cfunc
    }
    var argNames = argTypes.map((function(x, i) {
      return "$" + i
    }));
    var funcstr = "(function(" + argNames.join(",") + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      funcstr += "var stack = " + JSsource["stackSave"].body + ";";
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i],
          type = argTypes[i];
        if (type === "number") continue;
        var convertCode = JSsource[type + "ToC"];
        funcstr += "var " + convertCode.arguments + " = " + arg + ";";
        funcstr += convertCode.body + ";";
        funcstr += arg + "=" + convertCode.returnValue + ";"
      }
    }
    var cfuncname = parseJSFunc((function() {
      return cfunc
    })).returnValue;
    funcstr += "var ret = " + cfuncname + "(" + argNames.join(",") + ");";
    if (!numericRet) {
      var strgfy = parseJSFunc((function() {
        return Pointer_stringify
      })).returnValue;
      funcstr += "ret = " + strgfy + "(ret);"
    }
    if (!numericArgs) {
      funcstr += JSsource["stackRestore"].body.replace("()", "(stack)") + ";"
    }
    funcstr += "return ret})";
    return eval(funcstr)
  }
}))();
Module["cwrap"] = cwrap;
Module["ccall"] = ccall;

function setValue(ptr, value, type, noSafe) {
  type = type || "i8";
  if (type.charAt(type.length - 1) === "*") type = "i32";
  switch (type) {
    case "i1":
      HEAP8[ptr >> 0] = value;
      break;
    case "i8":
      HEAP8[ptr >> 0] = value;
      break;
    case "i16":
      HEAP16[ptr >> 1] = value;
      break;
    case "i32":
      HEAP32[ptr >> 2] = value;
      break;
    case "i64":
      tempI64 = [value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0)], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
      break;
    case "float":
      HEAPF32[ptr >> 2] = value;
      break;
    case "double":
      HEAPF64[ptr >> 3] = value;
      break;
    default:
      abort("invalid type for setValue: " + type)
  }
}
Module["setValue"] = setValue;

function getValue(ptr, type, noSafe) {
  type = type || "i8";
  if (type.charAt(type.length - 1) === "*") type = "i32";
  switch (type) {
    case "i1":
      return HEAP8[ptr >> 0];
    case "i8":
      return HEAP8[ptr >> 0];
    case "i16":
      return HEAP16[ptr >> 1];
    case "i32":
      return HEAP32[ptr >> 2];
    case "i64":
      return HEAP32[ptr >> 2];
    case "float":
      return HEAPF32[ptr >> 2];
    case "double":
      return HEAPF64[ptr >> 3];
    default:
      abort("invalid type for setValue: " + type)
  }
  return null
}
Module["getValue"] = getValue;
var ALLOC_NORMAL = 0;
var ALLOC_STACK = 1;
var ALLOC_STATIC = 2;
var ALLOC_DYNAMIC = 3;
var ALLOC_NONE = 4;
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === "number") {
    zeroinit = true;
    size = slab
  } else {
    zeroinit = false;
    size = slab.length
  }
  var singleType = typeof types === "string" ? types : null;
  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr
  } else {
    ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length))
  }
  if (zeroinit) {
    var ptr = ret,
      stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[ptr >> 2] = 0
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[ptr++ >> 0] = 0
    }
    return ret
  }
  if (singleType === "i8") {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret)
    } else {
      HEAPU8.set(new Uint8Array(slab), ret)
    }
    return ret
  }
  var i = 0,
    type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];
    if (typeof curr === "function") {
      curr = Runtime.getFunctionIndex(curr)
    }
    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue
    }
    if (type == "i64") type = "i32";
    setValue(ret + i, curr, type);
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type
    }
    i += typeSize
  }
  return ret
}
Module["allocate"] = allocate;

function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if (typeof _sbrk !== "undefined" && !_sbrk.called) return Runtime.dynamicAlloc(size);
  return _malloc(size)
}

function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return "";
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[ptr + i >> 0];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break
  }
  if (!length) length = i;
  var ret = "";
  if (hasUtf < 128) {
    var MAX_CHUNK = 1024;
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK
    }
    return ret
  }
  return Module["UTF8ToString"](ptr)
}
Module["Pointer_stringify"] = Pointer_stringify;

function AsciiToString(ptr) {
  var str = "";
  while (1) {
    var ch = HEAP8[ptr++ >> 0];
    if (!ch) return str;
    str += String.fromCharCode(ch)
  }
}
Module["AsciiToString"] = AsciiToString;

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false)
}
Module["stringToAscii"] = stringToAscii;

function UTF8ArrayToString(u8Array, idx) {
  var u0, u1, u2, u3, u4, u5;
  var str = "";
  while (1) {
    u0 = u8Array[idx++];
    if (!u0) return str;
    if (!(u0 & 128)) {
      str += String.fromCharCode(u0);
      continue
    }
    u1 = u8Array[idx++] & 63;
    if ((u0 & 224) == 192) {
      str += String.fromCharCode((u0 & 31) << 6 | u1);
      continue
    }
    u2 = u8Array[idx++] & 63;
    if ((u0 & 240) == 224) {
      u0 = (u0 & 15) << 12 | u1 << 6 | u2
    } else {
      u3 = u8Array[idx++] & 63;
      if ((u0 & 248) == 240) {
        u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u3
      } else {
        u4 = u8Array[idx++] & 63;
        if ((u0 & 252) == 248) {
          u0 = (u0 & 3) << 24 | u1 << 18 | u2 << 12 | u3 << 6 | u4
        } else {
          u5 = u8Array[idx++] & 63;
          u0 = (u0 & 1) << 30 | u1 << 24 | u2 << 18 | u3 << 12 | u4 << 6 | u5
        }
      }
    }
    if (u0 < 65536) {
      str += String.fromCharCode(u0)
    } else {
      var ch = u0 - 65536;
      str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8, ptr)
}
Module["UTF8ToString"] = UTF8ToString;

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) return 0;
  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1;
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i);
    if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
    if (u <= 127) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 192 | u >> 6;
      outU8Array[outIdx++] = 128 | u & 63
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 224 | u >> 12;
      outU8Array[outIdx++] = 128 | u >> 6 & 63;
      outU8Array[outIdx++] = 128 | u & 63
    } else if (u <= 2097151) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 240 | u >> 18;
      outU8Array[outIdx++] = 128 | u >> 12 & 63;
      outU8Array[outIdx++] = 128 | u >> 6 & 63;
      outU8Array[outIdx++] = 128 | u & 63
    } else if (u <= 67108863) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 248 | u >> 24;
      outU8Array[outIdx++] = 128 | u >> 18 & 63;
      outU8Array[outIdx++] = 128 | u >> 12 & 63;
      outU8Array[outIdx++] = 128 | u >> 6 & 63;
      outU8Array[outIdx++] = 128 | u & 63
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 252 | u >> 30;
      outU8Array[outIdx++] = 128 | u >> 24 & 63;
      outU8Array[outIdx++] = 128 | u >> 18 & 63;
      outU8Array[outIdx++] = 128 | u >> 12 & 63;
      outU8Array[outIdx++] = 128 | u >> 6 & 63;
      outU8Array[outIdx++] = 128 | u & 63
    }
  }
  outU8Array[outIdx] = 0;
  return outIdx - startIdx
}
Module["stringToUTF8Array"] = stringToUTF8Array;

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
}
Module["stringToUTF8"] = stringToUTF8;

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i);
    if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
    if (u <= 127) {
      ++len
    } else if (u <= 2047) {
      len += 2
    } else if (u <= 65535) {
      len += 3
    } else if (u <= 2097151) {
      len += 4
    } else if (u <= 67108863) {
      len += 5
    } else {
      len += 6
    }
  }
  return len
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

function UTF16ToString(ptr) {
  var i = 0;
  var str = "";
  while (1) {
    var codeUnit = HEAP16[ptr + i * 2 >> 1];
    if (codeUnit == 0) return str;
    ++i;
    str += String.fromCharCode(codeUnit)
  }
}
Module["UTF16ToString"] = UTF16ToString;

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 2147483647
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2;
  var startPtr = outPtr;
  var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    var codeUnit = str.charCodeAt(i);
    HEAP16[outPtr >> 1] = codeUnit;
    outPtr += 2
  }
  HEAP16[outPtr >> 1] = 0;
  return outPtr - startPtr
}
Module["stringToUTF16"] = stringToUTF16;

function lengthBytesUTF16(str) {
  return str.length * 2
}
Module["lengthBytesUTF16"] = lengthBytesUTF16;

function UTF32ToString(ptr) {
  var i = 0;
  var str = "";
  while (1) {
    var utf32 = HEAP32[ptr + i * 4 >> 2];
    if (utf32 == 0) return str;
    ++i;
    if (utf32 >= 65536) {
      var ch = utf32 - 65536;
      str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
    } else {
      str += String.fromCharCode(utf32)
    }
  }
}
Module["UTF32ToString"] = UTF32ToString;

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 2147483647
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 55296 && codeUnit <= 57343) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023
    }
    HEAP32[outPtr >> 2] = codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break
  }
  HEAP32[outPtr >> 2] = 0;
  return outPtr - startPtr
}
Module["stringToUTF32"] = stringToUTF32;

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 55296 && codeUnit <= 57343) ++i;
    len += 4
  }
  return len
}
Module["lengthBytesUTF32"] = lengthBytesUTF32;

function demangle(func) {
  var hasLibcxxabi = !!Module["___cxa_demangle"];
  if (hasLibcxxabi) {
    try {
      var buf = _malloc(func.length);
      writeStringToMemory(func.substr(1), buf);
      var status = _malloc(4);
      var ret = Module["___cxa_demangle"](buf, 0, 0, status);
      if (getValue(status, "i32") === 0 && ret) {
        return Pointer_stringify(ret)
      }
    } catch (e) {} finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret)
    }
  }
  var i = 3;
  var basicTypes = {
    "v": "void",
    "b": "bool",
    "c": "char",
    "s": "short",
    "i": "int",
    "l": "long",
    "f": "float",
    "d": "double",
    "w": "wchar_t",
    "a": "signed char",
    "h": "unsigned char",
    "t": "unsigned short",
    "j": "unsigned int",
    "m": "unsigned long",
    "x": "long long",
    "y": "unsigned long long",
    "z": "..."
  };
  var subs = [];
  var first = true;

  function dump(x) {
    if (x) Module.print(x);
    Module.print(func);
    var pre = "";
    for (var a = 0; a < i; a++) pre += " ";
    Module.print(pre + "^")
  }

  function parseNested() {
    i++;
    if (func[i] === "K") i++;
    var parts = [];
    while (func[i] !== "E") {
      if (func[i] === "S") {
        i++;
        var next = func.indexOf("_", i);
        var num = func.substring(i, next) || 0;
        parts.push(subs[num] || "?");
        i = next + 1;
        continue
      }
      if (func[i] === "C") {
        parts.push(parts[parts.length - 1]);
        i += 2;
        continue
      }
      var size = parseInt(func.substr(i));
      var pre = size.toString().length;
      if (!size || !pre) {
        i--;
        break
      }
      var curr = func.substr(i + pre, size);
      parts.push(curr);
      subs.push(curr);
      i += pre + size
    }
    i++;
    return parts
  }

  function parse(rawList, limit, allowVoid) {
    limit = limit || Infinity;
    var ret = "",
      list = [];

    function flushList() {
      return "(" + list.join(", ") + ")"
    }
    var name;
    if (func[i] === "N") {
      name = parseNested().join("::");
      limit--;
      if (limit === 0) return rawList ? [name] : name
    } else {
      if (func[i] === "K" || first && func[i] === "L") i++;
      var size = parseInt(func.substr(i));
      if (size) {
        var pre = size.toString().length;
        name = func.substr(i + pre, size);
        i += pre + size
      }
    }
    first = false;
    if (func[i] === "I") {
      i++;
      var iList = parse(true);
      var iRet = parse(true, 1, true);
      ret += iRet[0] + " " + name + "<" + iList.join(", ") + ">"
    } else {
      ret = name
    }
    paramLoop: while (i < func.length && limit-- > 0) {
      var c = func[i++];
      if (c in basicTypes) {
        list.push(basicTypes[c])
      } else {
        switch (c) {
          case "P":
            list.push(parse(true, 1, true)[0] + "*");
            break;
          case "R":
            list.push(parse(true, 1, true)[0] + "&");
            break;
          case "L":
            {
              i++;
              var end = func.indexOf("E", i);
              var size = end - i;
              list.push(func.substr(i, size));
              i += size + 2;
              break
            };
          case "A":
            {
              var size = parseInt(func.substr(i));
              i += size.toString().length;
              if (func[i] !== "_") throw "?";
              i++;
              list.push(parse(true, 1, true)[0] + " [" + size + "]");
              break
            };
          case "E":
            break paramLoop;
          default:
            ret += "?" + c;
            break paramLoop
        }
      }
    }
    if (!allowVoid && list.length === 1 && list[0] === "void") list = [];
    if (rawList) {
      if (ret) {
        list.push(ret + "?")
      }
      return list
    } else {
      return ret + flushList()
    }
  }
  var parsed = func;
  try {
    if (func == "Object._main" || func == "_main") {
      return "main()"
    }
    if (typeof func === "number") func = Pointer_stringify(func);
    if (func[0] !== "_") return func;
    if (func[1] !== "_") return func;
    if (func[2] !== "Z") return func;
    switch (func[3]) {
      case "n":
        return "operator new()";
      case "d":
        return "operator delete()"
    }
    parsed = parse()
  } catch (e) {
    parsed += "?"
  }
  if (parsed.indexOf("?") >= 0 && !hasLibcxxabi) {
    Runtime.warnOnce("warning: a problem occurred in builtin C++ name demangling; build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling")
  }
  return parsed
}

function demangleAll(text) {
  return text.replace(/__Z[\w\d_]+/g, (function(x) {
    var y = demangle(x);
    return x === y ? x : x + " [" + y + "]"
  }))
}

function jsStackTrace() {
  var err = new Error;
  if (!err.stack) {
    try {
      throw new Error(0)
    } catch (e) {
      err = e
    }
    if (!err.stack) {
      return "(no stack trace available)"
    }
  }
  return err.stack.toString()
}

function stackTrace() {
  return demangleAll(jsStackTrace())
}
Module["stackTrace"] = stackTrace;
var PAGE_SIZE = 4096;

function alignMemoryPage(x) {
  if (x % 4096 > 0) {
    x += 4096 - x % 4096
  }
  return x
}
var HEAP;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
var STATIC_BASE = 0,
  STATICTOP = 0,
  staticSealed = false;
var STACK_BASE = 0,
  STACKTOP = 0,
  STACK_MAX = 0;
var DYNAMIC_BASE = 0,
  DYNAMICTOP = 0;

function enlargeMemory() {
  var OLD_TOTAL_MEMORY = TOTAL_MEMORY;
  var LIMIT = Math.pow(2, 31);
  if (DYNAMICTOP >= LIMIT) return false;
  while (TOTAL_MEMORY <= DYNAMICTOP) {
    if (TOTAL_MEMORY < LIMIT / 2) {
      TOTAL_MEMORY = alignMemoryPage(2 * TOTAL_MEMORY)
    } else {
      var last = TOTAL_MEMORY;
      TOTAL_MEMORY = alignMemoryPage((3 * TOTAL_MEMORY + LIMIT) / 4);
      if (TOTAL_MEMORY <= last) return false
    }
  }
  TOTAL_MEMORY = Math.max(TOTAL_MEMORY, 16 * 1024 * 1024);
  if (TOTAL_MEMORY >= LIMIT) return false;
  try {
    if (ArrayBuffer.transfer) {
      buffer = ArrayBuffer.transfer(buffer, TOTAL_MEMORY)
    } else {
      var oldHEAP8 = HEAP8;
      buffer = new ArrayBuffer(TOTAL_MEMORY)
    }
  } catch (e) {
    return false
  }
  var success = _emscripten_replace_memory(buffer);
  if (!success) return false;
  Module["buffer"] = buffer;
  Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
  Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
  Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
  Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
  Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
  Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
  Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
  Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer);
  if (!ArrayBuffer.transfer) {
    HEAP8.set(oldHEAP8)
  }
  return true
}
var byteLength;
try {
  byteLength = Function.prototype.call.bind(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get);
  byteLength(new ArrayBuffer(4))
} catch (e) {
  byteLength = (function(buffer) {
    return buffer.byteLength
  })
}
var TOTAL_STACK = Module["TOTAL_STACK"] || 5242880;
var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 16777216;
var totalMemory = 64 * 1024;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2 * TOTAL_STACK) {
  if (totalMemory < 16 * 1024 * 1024) {
    totalMemory *= 2
  } else {
    totalMemory += 16 * 1024 * 1024
  }
}
totalMemory = Math.max(totalMemory, 16 * 1024 * 1024);
if (totalMemory !== TOTAL_MEMORY) {
  Module.printErr("increasing TOTAL_MEMORY to " + totalMemory + " to be compliant with the asm.js spec (and given that TOTAL_STACK=" + TOTAL_STACK + ")");
  TOTAL_MEMORY = totalMemory
}
assert(typeof Int32Array !== "undefined" && typeof Float64Array !== "undefined" && !!(new Int32Array(1))["subarray"] && !!(new Int32Array(1))["set"], "JS engine does not provide full typed array support");
var buffer;
buffer = new ArrayBuffer(TOTAL_MEMORY);
HEAP8 = new Int8Array(buffer);
HEAP16 = new Int16Array(buffer);
HEAP32 = new Int32Array(buffer);
HEAPU8 = new Uint8Array(buffer);
HEAPU16 = new Uint16Array(buffer);
HEAPU32 = new Uint32Array(buffer);
HEAPF32 = new Float32Array(buffer);
HEAPF64 = new Float64Array(buffer);
HEAP32[0] = 255;
assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, "Typed arrays 2 must be run on a little-endian system");
Module["HEAP"] = HEAP;
Module["buffer"] = buffer;
Module["HEAP8"] = HEAP8;
Module["HEAP16"] = HEAP16;
Module["HEAP32"] = HEAP32;
Module["HEAPU8"] = HEAPU8;
Module["HEAPU16"] = HEAPU16;
Module["HEAPU32"] = HEAPU32;
Module["HEAPF32"] = HEAPF32;
Module["HEAPF64"] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while (callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == "function") {
      callback();
      continue
    }
    var func = callback.func;
    if (typeof func === "number") {
      if (callback.arg === undefined) {
        Runtime.dynCall("v", func)
      } else {
        Runtime.dynCall("vi", func, [callback.arg])
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg)
    }
  }
}
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATMAIN__ = [];
var __ATEXIT__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
var runtimeExited = false;

function preRun() {
  if (Module["preRun"]) {
    if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
    while (Module["preRun"].length) {
      addOnPreRun(Module["preRun"].shift())
    }
  }
  callRuntimeCallbacks(__ATPRERUN__)
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__)
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__)
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true
}

function postRun() {
  if (Module["postRun"]) {
    if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
    while (Module["postRun"].length) {
      addOnPostRun(Module["postRun"].shift())
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__)
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb)
}
Module["addOnPreRun"] = Module.addOnPreRun = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb)
}
Module["addOnInit"] = Module.addOnInit = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb)
}
Module["addOnPreMain"] = Module.addOnPreMain = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb)
}
Module["addOnExit"] = Module.addOnExit = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb)
}
Module["addOnPostRun"] = Module.addOnPostRun = addOnPostRun;

function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 255) {
      chr &= 255
    }
    ret.push(String.fromCharCode(chr))
  }
  return ret.join("")
}
Module["intArrayToString"] = intArrayToString;

function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[buffer + i >> 0] = chr;
    i = i + 1
  }
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[buffer++ >> 0] = array[i]
  }
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[buffer++ >> 0] = str.charCodeAt(i)
  }
  if (!dontAddNull) HEAP8[buffer >> 0] = 0
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value
  }
  return bits <= 32 ? 2 * Math.abs(1 << bits - 1) + value : Math.pow(2, bits) + value
}

function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value
  }
  var half = bits <= 32 ? Math.abs(1 << bits - 1) : Math.pow(2, bits - 1);
  if (value >= half && (bits <= 32 || value > half)) {
    value = -2 * half + value
  }
  return value
}
if (!Math["imul"] || Math["imul"](4294967295, 5) !== -5) Math["imul"] = function imul(a, b) {
  var ah = a >>> 16;
  var al = a & 65535;
  var bh = b >>> 16;
  var bl = b & 65535;
  return al * bl + (ah * bl + al * bh << 16) | 0
};
Math.imul = Math["imul"];
if (!Math["clz32"]) Math["clz32"] = (function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & 1 << 31 - i) return i
  }
  return 32
});
Math.clz32 = Math["clz32"];
var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;

function getUniqueRunDependency(id) {
  return id
}

function addRunDependency(id) {
  runDependencies++;
  if (Module["monitorRunDependencies"]) {
    Module["monitorRunDependencies"](runDependencies)
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module["monitorRunDependencies"]) {
    Module["monitorRunDependencies"](runDependencies)
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback()
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;
Module["preloadedImages"] = {};
Module["preloadedAudios"] = {};
var memoryInitializer = null;
var ASM_CONSTS = [(function($0, $1, $2) {
  {
    Sass._sassCompileEmscriptenSuccess(pointerToString($0), pointerToJson($1), pointerToStringArray($2))
  }
}), (function($0, $1) {
  {
    Sass._sassCompileEmscriptenError(pointerToJson($0), pointerToString($1))
  }
}), (function($0, $1) {
  {
    Importer.find(pointerToString($0), pointerToString($1))
  }
}), (function() {
  {
    return Number(Importer.finished())
  }
}), (function() {
  {
    return Number(Importer.error())
  }
}), (function() {
  {
    return Number(Importer.path())
  }
}), (function() {
  {
    return Number(Importer.content())
  }
})];

function _emscripten_asm_const_1(code, a0) {
  return ASM_CONSTS[code](a0) | 0
}

function _emscripten_asm_const_2(code, a0, a1) {
  return ASM_CONSTS[code](a0, a1) | 0
}

function _emscripten_asm_const_3(code, a0, a1, a2) {
  return ASM_CONSTS[code](a0, a1, a2) | 0
}
STATIC_BASE = 8;
STATICTOP = STATIC_BASE + 58336;
__ATINIT__.push({
  func: (function() {
    __GLOBAL__sub_I_ast_cpp()
  })
}, {
  func: (function() {
    __GLOBAL__sub_I_context_cpp()
  })
}, {
  func: (function() {
    __GLOBAL__sub_I_file_cpp()
  })
}, {
  func: (function() {
    __GLOBAL__sub_I_functions_cpp()
  })
}, {
  func: (function() {
    __GLOBAL__sub_I_sass2scss_cpp()
  })
}, {
  func: (function() {
    __GLOBAL__sub_I_iostream_cpp()
  })
});
var memoryInitializer = "libsass.js.mem";
var tempDoublePtr = Runtime.alignMemory(allocate(12, "i8", ALLOC_STATIC), 8);
assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) {
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
  HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
  HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3]
}

function copyTempDouble(ptr) {
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
  HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
  HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3];
  HEAP8[tempDoublePtr + 4] = HEAP8[ptr + 4];
  HEAP8[tempDoublePtr + 5] = HEAP8[ptr + 5];
  HEAP8[tempDoublePtr + 6] = HEAP8[ptr + 6];
  HEAP8[tempDoublePtr + 7] = HEAP8[ptr + 7]
}
var EMTSTACKTOP = getMemory(1048576);
var EMT_STACK_MAX = EMTSTACKTOP + 1048576;
var eb = getMemory(27664);
__ATPRERUN__.push((function() {
  HEAPU8.set([140, 1, 64, 0, 0, 0, 0, 0, 2, 54, 0, 0, 181, 1, 0, 0, 2, 55, 0, 0, 160, 0, 0, 0, 2, 56, 0, 0, 144, 1, 0, 0, 2, 57, 0, 0, 190, 0, 0, 0, 2, 58, 0, 0, 13, 1, 0, 0, 2, 59, 0, 0, 236, 2, 0, 0, 1, 53, 0, 0, 136, 60, 0, 0, 0, 49, 60, 0, 136, 60, 0, 0, 3, 60, 60, 56, 137, 60, 0, 0, 1, 60, 116, 1, 3, 48, 49, 60, 1, 60, 80, 1, 3, 25, 49, 60, 1, 60, 36, 1, 3, 26, 49, 60, 1, 60, 28, 1, 3, 34, 49, 60, 1, 60, 156, 0, 3, 39, 49, 60, 25, 42, 49, 60, 25, 43, 49, 64, 1, 60, 32, 1, 3, 44, 49, 60, 25, 45, 49, 68, 25, 46, 49, 72, 25, 47, 49, 76, 25, 27, 49, 80, 25, 28, 49, 84, 1, 60, 76, 1, 3, 29, 49, 60, 1, 60, 84, 1, 3, 30, 49, 60, 1, 60, 96, 1, 3, 31, 49, 60, 1, 60, 112, 1, 3, 32, 49, 60, 1, 60, 128, 1, 3, 33, 49, 60, 3, 16, 49, 55, 1, 60, 164, 0, 3, 17, 49, 60, 1, 60, 168, 0, 3, 11, 49, 60, 1, 60, 172, 0, 3, 5, 49, 60, 1, 60, 176, 0, 3, 6, 49, 60, 1, 60, 224, 0, 3, 4, 49, 60, 1, 60, 16, 1, 3, 20, 49, 60, 25, 14, 49, 48, 0, 18, 49, 0, 1, 60, 40, 1, 3, 19, 49, 60, 1, 60, 52, 1, 3, 52, 49, 60, 25, 35, 49, 88, 1, 60, 64, 1, 3, 50, 49, 60, 1, 60, 136, 0, 3, 36, 49, 60, 1, 60, 88, 1, 3, 37, 49, 60, 1, 60, 144, 0, 3, 38, 49, 60, 1, 60, 100, 1, 3, 40, 49, 60, 25, 41, 0, 48, 82, 24, 41, 0, 25, 3, 24, 4, 1, 60, 92, 0, 135, 51, 0, 0, 60, 0, 0, 0, 85, 48, 51, 0, 25, 12, 24, 8, 82, 7, 12, 0, 106, 60, 24, 12, 45, 60, 7, 60, 120, 1, 0, 0, 135, 60, 1, 0, 3, 48, 0, 0, 119, 0, 5, 0, 85, 7, 51, 0, 82, 60, 12, 0, 25, 60, 60, 4, 85, 12, 60, 0, 25, 22, 0, 116, 116, 6, 22, 0, 106, 61, 22, 4, 109, 6, 4, 61, 106, 60, 22, 8, 109, 6, 8, 60, 25, 7, 6, 12, 1, 60, 128, 0, 3, 23, 0, 60, 1, 60, 0, 0, 132, 0, 0, 60, 135, 60, 2, 0, 56, 7, 23, 0, 130, 60, 0, 0, 0, 24, 60, 0, 1, 60, 0, 0, 132, 0, 0, 60, 38, 60, 24, 1, 121, 60, 5, 0, 135, 5, 3, 0, 128, 60, 0, 0, 0, 4, 60, 0, 119, 0, 172, 9, 25, 21, 6, 24, 1, 60, 140, 0, 3, 24, 0, 60, 116, 21, 24, 0, 106, 61, 24, 4, 109, 21, 4, 61, 106, 60, 24, 8, 109, 21, 8, 60, 106, 61, 24, 12, 109, 21, 12, 61, 106, 60, 24, 16, 109, 21, 16, 60, 106, 61, 24, 20, 109, 21, 20, 61, 1, 61, 0, 0, 132, 0, 0, 61, 1, 60, 17, 0, 1, 62, 0, 0, 1, 63, 0, 0, 135, 61, 4, 0, 60, 51, 6, 62, 63, 0, 0, 0, 130, 61, 0, 0, 0, 21, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 21, 1, 121, 61, 7, 0, 135, 5, 3, 0, 128, 61, 0, 0, 0, 4, 61, 0, 135, 61, 5, 0, 7, 0, 0, 0, 119, 0, 138, 9, 135, 61, 5, 0, 7, 0, 0, 0, 85, 5, 51, 0, 25, 21, 0, 56, 82, 7, 21, 0, 106, 61, 0, 60, 45, 61, 7, 61, 156, 2, 0, 0, 25, 63, 0, 52, 135, 61, 6, 0, 63, 5, 0, 0, 119, 0, 5, 0, 85, 7, 51, 0, 82, 61, 21, 0, 25, 61, 61, 4, 85, 21, 61, 0, 1, 63, 1, 0, 107, 51, 88, 63, 135, 63, 7, 0, 0, 0, 0, 0, 82, 7, 41, 0, 106, 63, 7, 92, 106, 61, 7, 88, 4, 63, 63, 61, 32, 63, 63, 28, 121, 63, 217, 1, 25, 3, 7, 4, 1, 63, 92, 0, 135, 15, 0, 0, 63, 0, 0, 0, 85, 48, 15, 0, 25, 13, 7, 8, 82, 6, 13, 0, 106, 63, 7, 12, 45, 63, 6, 63, 8, 3, 0, 0, 135, 63, 1, 0, 3, 48, 0, 0, 119, 0, 5, 0, 85, 6, 15, 0, 82, 63, 13, 0, 25, 63, 63, 4, 85, 13, 63, 0, 116, 4, 22, 0, 106, 61, 22, 4, 109, 4, 4, 61, 106, 63, 22, 8, 109, 4, 8, 63, 25, 7, 4, 12, 1, 63, 0, 0, 132, 0, 0, 63, 135, 63, 2, 0, 56, 7, 23, 0, 130, 63, 0, 0, 0, 12, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 12, 1, 121, 63, 5, 0, 135, 5, 3, 0, 128, 63, 0, 0, 0, 4, 63, 0, 119, 0, 138, 1, 25, 12, 4, 24, 116, 12, 24, 0, 106, 61, 24, 4, 109, 12, 4, 61, 106, 63, 24, 8, 109, 12, 8, 63, 106, 61, 24, 12, 109, 12, 12, 61, 106, 63, 24, 16, 109, 12, 16, 63, 106, 61, 24, 20, 109, 12, 20, 61, 1, 61, 0, 0, 132, 0, 0, 61, 1, 63, 205, 1, 135, 61, 2, 0, 63, 15, 4, 0, 130, 61, 0, 0, 0, 12, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 12, 1, 121, 61, 7, 0, 135, 5, 3, 0, 128, 61, 0, 0, 0, 4, 61, 0, 135, 61, 5, 0, 7, 0, 0, 0, 119, 0, 109, 1, 135, 61, 5, 0, 7, 0, 0, 0, 82, 63, 41, 0, 106, 63, 63, 88, 25, 63, 63, 12, 135, 61, 8, 0, 20, 63, 0, 0, 1, 61, 0, 0, 132, 0, 0, 61, 1, 63, 169, 1, 82, 62, 41, 0, 1, 60, 232, 0, 3, 62, 62, 60, 135, 61, 2, 0, 63, 14, 62, 0, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 3, 0, 1, 53, 44, 0, 119, 0, 77, 1, 1, 61, 0, 0, 132, 0, 0, 61, 1, 62, 27, 0, 1, 63, 0, 0, 135, 61, 9, 0, 62, 0, 20, 15, 14, 63, 0, 0, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 19, 0, 135, 1, 3, 0, 82, 4, 14, 0, 120, 4, 2, 0, 119, 0, 60, 1, 25, 2, 14, 4, 82, 3, 2, 0, 46, 61, 3, 4, 168, 4, 0, 0, 26, 61, 3, 4, 4, 61, 61, 4, 43, 61, 61, 2, 11, 61, 61, 0, 41, 61, 61, 2, 3, 61, 3, 61, 85, 2, 61, 0, 135, 61, 10, 0, 4, 0, 0, 0, 119, 0, 46, 1, 82, 5, 14, 0, 0, 4, 5, 0, 121, 5, 14, 0, 25, 7, 14, 4, 82, 6, 7, 0, 46, 61, 6, 5, 236, 4, 0, 0, 26, 61, 6, 4, 4, 61, 61, 4, 43, 61, 61, 2, 11, 61, 61, 0, 41, 61, 61, 2, 3, 61, 6, 61, 85, 7, 61, 0, 135, 61, 10, 0, 5, 0, 0, 0, 82, 14, 41, 0, 106, 61, 14, 92, 106, 63, 14, 88, 4, 61, 61, 63, 28, 61, 61, 28, 26, 61, 61, 1, 85, 14, 61, 0, 106, 61, 15, 80, 106, 63, 15, 84, 46, 61, 61, 63, 192, 5, 0, 0, 25, 7, 51, 68, 85, 11, 15, 0, 1, 63, 0, 0, 109, 51, 84, 63, 25, 6, 51, 76, 82, 5, 6, 0, 106, 63, 51, 80, 45, 63, 5, 63, 120, 5, 0, 0, 1, 63, 0, 0, 132, 0, 0, 63, 25, 61, 51, 72, 135, 63, 2, 0, 54, 61, 11, 0, 130, 63, 0, 0, 0, 14, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 14, 1, 121, 63, 7, 0, 1, 53, 44, 0, 119, 0, 253, 0, 85, 5, 15, 0, 82, 63, 6, 0, 25, 63, 63, 4, 85, 6, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 82, 61, 7, 0, 82, 61, 61, 0, 135, 63, 2, 0, 61, 7, 15, 0, 130, 63, 0, 0, 0, 14, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 14, 1, 121, 63, 3, 0, 1, 53, 44, 0, 119, 0, 235, 0, 25, 14, 15, 68, 82, 6, 14, 0, 106, 7, 15, 72, 46, 63, 6, 7, 92, 9, 0, 0, 4, 63, 7, 6, 28, 5, 63, 12, 25, 1, 51, 68, 25, 15, 18, 12, 25, 8, 18, 24, 25, 9, 51, 84, 25, 10, 51, 76, 25, 11, 51, 80, 25, 12, 51, 72, 1, 13, 0, 0, 82, 7, 41, 0, 25, 3, 7, 4, 1, 63, 0, 0, 132, 0, 0, 63, 1, 63, 131, 0, 1, 61, 80, 0, 135, 2, 11, 0, 63, 61, 0, 0, 130, 61, 0, 0, 0, 6, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 6, 1, 121, 61, 3, 0, 1, 53, 43, 0, 119, 0, 127, 0, 85, 17, 2, 0, 25, 4, 7, 8, 82, 6, 4, 0, 106, 61, 7, 12, 45, 61, 6, 61, 136, 6, 0, 0, 1, 61, 0, 0, 132, 0, 0, 61, 1, 63, 141, 1, 135, 61, 2, 0, 63, 3, 17, 0, 130, 61, 0, 0, 0, 7, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 7, 1, 121, 61, 7, 0, 1, 53, 43, 0, 119, 0, 108, 0, 85, 6, 2, 0, 82, 61, 4, 0, 25, 61, 61, 4, 85, 4, 61, 0, 116, 18, 22, 0, 106, 63, 22, 4, 109, 18, 4, 63, 106, 61, 22, 8, 109, 18, 8, 61, 1, 61, 0, 0, 132, 0, 0, 61, 135, 61, 2, 0, 56, 15, 23, 0, 130, 61, 0, 0, 0, 7, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 7, 1, 121, 61, 3, 0, 1, 53, 64, 0, 119, 0, 87, 0, 116, 8, 24, 0, 106, 63, 24, 4, 109, 8, 4, 63, 106, 61, 24, 8, 109, 8, 8, 61, 106, 63, 24, 12, 109, 8, 12, 63, 106, 61, 24, 16, 109, 8, 16, 61, 106, 63, 24, 20, 109, 8, 20, 63, 1, 63, 0, 0, 132, 0, 0, 63, 82, 61, 14, 0, 27, 62, 13, 12, 3, 61, 61, 62, 135, 63, 2, 0, 56, 19, 61, 0, 130, 63, 0, 0, 0, 7, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 7, 1, 121, 63, 3, 0, 1, 53, 65, 0, 119, 0, 61, 0, 1, 63, 0, 0, 132, 0, 0, 63, 135, 63, 12, 0, 57, 2, 18, 19, 130, 63, 0, 0, 0, 7, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 7, 1, 121, 63, 4, 0, 1, 6, 1, 0, 1, 53, 66, 0, 119, 0, 48, 0, 85, 16, 2, 0, 1, 63, 0, 0, 85, 9, 63, 0, 82, 7, 10, 0, 82, 63, 11, 0, 45, 63, 7, 63, 200, 7, 0, 0, 1, 63, 0, 0, 132, 0, 0, 63, 135, 63, 2, 0, 54, 12, 16, 0, 130, 63, 0, 0, 0, 7, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 7, 1, 121, 63, 8, 0, 1, 6, 0, 0, 1, 53, 66, 0, 119, 0, 28, 0, 85, 7, 2, 0, 82, 63, 10, 0, 25, 63, 63, 4, 85, 10, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 82, 61, 1, 0, 82, 61, 61, 0, 135, 63, 2, 0, 61, 1, 2, 0, 130, 63, 0, 0, 0, 7, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 7, 1, 121, 63, 4, 0, 1, 6, 0, 0, 1, 53, 66, 0, 119, 0, 9, 0, 135, 63, 5, 0, 19, 0, 0, 0, 135, 63, 5, 0, 15, 0, 0, 0, 25, 13, 13, 1, 57, 63, 5, 13, 92, 9, 0, 0, 119, 0, 115, 255, 32, 63, 53, 43, 121, 63, 4, 0, 135, 1, 3, 0, 1, 53, 45, 0, 119, 0, 73, 0, 32, 63, 53, 64, 121, 63, 6, 0, 135, 1, 3, 0, 128, 63, 0, 0, 0, 7, 63, 0, 0, 6, 4, 0, 119, 0, 23, 0, 32, 63, 53, 65, 121, 63, 8, 0, 135, 1, 3, 0, 128, 63, 0, 0, 0, 7, 63, 0, 135, 63, 5, 0, 15, 0, 0, 0, 0, 6, 4, 0, 119, 0, 14, 0, 32, 63, 53, 66, 121, 63, 12, 0, 135, 1, 3, 0, 128, 63, 0, 0, 0, 5, 63, 0, 135, 63, 5, 0, 19, 0, 0, 0, 135, 63, 5, 0, 15, 0, 0, 0, 121, 6, 47, 0, 0, 7, 5, 0, 0, 6, 4, 0, 119, 0, 1, 0, 82, 3, 3, 0, 82, 5, 6, 0, 45, 63, 3, 5, 212, 8, 0, 0, 0, 4, 3, 0, 119, 0, 11, 0, 0, 4, 3, 0, 82, 63, 4, 0, 52, 63, 63, 2, 252, 8, 0, 0, 25, 4, 4, 4, 45, 63, 4, 5, 248, 8, 0, 0, 0, 4, 5, 0, 119, 0, 2, 0, 119, 0, 248, 255, 4, 63, 4, 3, 42, 63, 63, 2, 25, 63, 63, 1, 41, 63, 63, 2, 3, 52, 3, 63, 4, 3, 5, 52, 135, 63, 13, 0, 4, 52, 3, 0, 42, 63, 3, 2, 41, 63, 63, 2, 3, 4, 4, 63, 82, 3, 6, 0, 46, 63, 3, 4, 80, 9, 0, 0, 26, 63, 3, 4, 4, 63, 63, 4, 43, 63, 63, 2, 11, 63, 63, 0, 41, 63, 63, 2, 3, 63, 3, 63, 85, 6, 63, 0, 135, 63, 10, 0, 2, 0, 0, 0, 119, 0, 4, 0, 135, 63, 5, 0, 20, 0, 0, 0, 119, 0, 52, 0, 32, 63, 53, 44, 121, 63, 3, 0, 135, 1, 3, 0, 1, 53, 45, 0, 135, 63, 5, 0, 20, 0, 0, 0, 0, 53, 1, 0, 135, 63, 14, 0, 53, 0, 0, 0, 82, 3, 3, 0, 82, 1, 13, 0, 45, 63, 3, 1, 164, 9, 0, 0, 0, 2, 3, 0, 119, 0, 11, 0, 0, 2, 3, 0, 82, 63, 2, 0, 52, 63, 63, 15, 204, 9, 0, 0, 25, 2, 2, 4, 45, 63, 2, 1, 200, 9, 0, 0, 0, 2, 1, 0, 119, 0, 2, 0, 119, 0, 248, 255, 4, 63, 2, 3, 42, 63, 63, 2, 25, 63, 63, 1, 41, 63, 63, 2, 3, 53, 3, 63, 4, 1, 1, 53, 135, 63, 13, 0, 2, 53, 1, 0, 42, 63, 1, 2, 41, 63, 63, 2, 3, 2, 2, 63, 82, 1, 13, 0, 46, 63, 1, 2, 32, 10, 0, 0, 26, 63, 1, 4, 4, 63, 63, 2, 43, 63, 63, 2, 11, 63, 63, 0, 41, 63, 63, 2, 3, 63, 1, 63, 85, 13, 63, 0, 135, 63, 10, 0, 15, 0, 0, 0, 0, 53, 5, 0, 135, 63, 14, 0, 53, 0, 0, 0, 1, 63, 0, 0, 85, 52, 63, 0, 1, 61, 0, 0, 109, 52, 4, 61, 1, 63, 0, 0, 109, 52, 8, 63, 1, 63, 0, 0, 132, 0, 0, 63, 1, 61, 20, 3, 1, 62, 1, 0, 135, 63, 15, 0, 61, 0, 62, 0, 130, 63, 0, 0, 0, 20, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 20, 1, 121, 63, 4, 0, 135, 1, 3, 0, 1, 53, 92, 0, 119, 0, 126, 7, 25, 20, 0, 84, 25, 19, 0, 88, 25, 18, 0, 104, 25, 17, 36, 4, 25, 16, 37, 4, 25, 15, 51, 68, 25, 14, 51, 84, 25, 12, 51, 76, 25, 11, 51, 80, 25, 10, 51, 72, 25, 8, 35, 12, 25, 9, 35, 24, 82, 63, 19, 0, 82, 62, 20, 0, 50, 63, 63, 62, 208, 10, 0, 0, 1, 53, 25, 1, 119, 0, 4, 7, 1, 63, 0, 0, 132, 0, 0, 63, 1, 62, 239, 1, 135, 63, 2, 0, 62, 0, 51, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 247, 6, 82, 7, 20, 0, 1, 63, 0, 0, 132, 0, 0, 63, 135, 6, 11, 0, 55, 7, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 234, 6, 1, 63, 0, 0, 132, 0, 0, 63, 1, 63, 164, 0, 33, 61, 6, 0, 125, 62, 61, 6, 7, 0, 0, 0, 135, 7, 11, 0, 63, 62, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 218, 6, 120, 7, 161, 5, 82, 7, 20, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 6, 11, 0, 55, 7, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 204, 6, 1, 62, 0, 0, 132, 0, 0, 62, 1, 62, 166, 0, 33, 61, 6, 0, 125, 63, 61, 6, 7, 0, 0, 0, 135, 7, 11, 0, 62, 63, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 188, 6, 120, 7, 81, 5, 82, 7, 20, 0, 1, 63, 0, 0, 132, 0, 0, 63, 135, 6, 11, 0, 55, 7, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 174, 6, 1, 63, 0, 0, 132, 0, 0, 63, 1, 63, 167, 0, 33, 61, 6, 0, 125, 62, 61, 6, 7, 0, 0, 0, 135, 7, 11, 0, 63, 62, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 158, 6, 120, 7, 51, 5, 82, 7, 20, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 6, 11, 0, 55, 7, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 144, 6, 1, 62, 0, 0, 132, 0, 0, 62, 1, 62, 169, 0, 33, 61, 6, 0, 125, 63, 61, 6, 7, 0, 0, 0, 135, 7, 11, 0, 62, 63, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 128, 6, 121, 7, 66, 0, 1, 63, 0, 0, 132, 0, 0, 63, 1, 63, 170, 0, 135, 7, 11, 0, 63, 0, 0, 0, 130, 63, 0, 0, 0, 53, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 53, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 114, 6, 85, 28, 7, 0, 1, 63, 0, 0, 85, 14, 63, 0, 82, 6, 12, 0, 82, 63, 11, 0, 45, 63, 6, 63, 100, 13, 0, 0, 1, 63, 0, 0, 132, 0, 0, 63, 135, 63, 2, 0, 54, 10, 28, 0, 130, 63, 0, 0, 0, 53, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 53, 1, 121, 63, 7, 0, 1, 53, 90, 0, 119, 0, 95, 6, 85, 6, 7, 0, 82, 63, 12, 0, 25, 63, 63, 4, 85, 12, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 82, 62, 15, 0, 82, 62, 62, 0, 135, 63, 2, 0, 62, 15, 7, 0, 130, 63, 0, 0, 0, 53, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 53, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 77, 6, 1, 63, 0, 0, 132, 0, 0, 63, 1, 62, 56, 123, 135, 63, 15, 0, 59, 52, 62, 0, 130, 63, 0, 0, 0, 53, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 53, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 64, 6, 1, 53, 13, 1, 119, 0, 223, 5, 82, 7, 20, 0, 1, 63, 0, 0, 132, 0, 0, 63, 135, 6, 11, 0, 55, 7, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 49, 6, 1, 63, 0, 0, 132, 0, 0, 63, 1, 63, 171, 0, 33, 61, 6, 0, 125, 62, 61, 6, 7, 0, 0, 0, 135, 7, 11, 0, 63, 62, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 33, 6, 121, 7, 68, 0, 1, 62, 0, 0, 132, 0, 0, 62, 1, 62, 172, 0, 135, 7, 11, 0, 62, 0, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 19, 6, 85, 27, 7, 0, 1, 62, 0, 0, 85, 14, 62, 0, 82, 6, 12, 0, 82, 62, 11, 0, 45, 62, 6, 62, 224, 14, 0, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 62, 2, 0, 54, 10, 27, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 7, 0, 1, 53, 90, 0, 119, 0, 0, 6, 85, 6, 7, 0, 82, 62, 12, 0, 25, 62, 62, 4, 85, 12, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 82, 63, 15, 0, 82, 63, 63, 0, 135, 62, 2, 0, 63, 15, 7, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 238, 5, 106, 62, 7, 68, 120, 62, 141, 5, 1, 62, 0, 0, 132, 0, 0, 62, 1, 63, 112, 123, 135, 62, 15, 0, 59, 52, 63, 0, 130, 62, 0, 0, 0, 53, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 53, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 223, 5, 1, 53, 13, 1, 119, 0, 126, 5, 82, 7, 20, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 6, 11, 0, 55, 7, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 208, 5, 1, 62, 0, 0, 132, 0, 0, 62, 1, 62, 173, 0, 33, 61, 6, 0, 125, 63, 61, 6, 7, 0, 0, 0, 135, 7, 11, 0, 62, 63, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 192, 5, 121, 7, 52, 0, 1, 63, 0, 0, 132, 0, 0, 63, 1, 63, 21, 3, 1, 62, 0, 0, 135, 7, 15, 0, 63, 0, 62, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 177, 5, 85, 47, 7, 0, 1, 62, 0, 0, 85, 14, 62, 0, 82, 6, 12, 0, 82, 62, 11, 0, 45, 62, 6, 62, 104, 16, 0, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 62, 2, 0, 54, 10, 47, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 7, 0, 1, 53, 90, 0, 119, 0, 158, 5, 85, 6, 7, 0, 82, 62, 12, 0, 25, 62, 62, 4, 85, 12, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 82, 63, 15, 0, 82, 63, 63, 0, 135, 62, 2, 0, 63, 15, 7, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 47, 5, 1, 53, 90, 0, 119, 0, 140, 5, 82, 7, 20, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 6, 11, 0, 55, 7, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 127, 5, 1, 62, 0, 0, 132, 0, 0, 62, 1, 62, 174, 0, 33, 61, 6, 0, 125, 63, 61, 6, 7, 0, 0, 0, 135, 7, 11, 0, 62, 63, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 111, 5, 121, 7, 51, 0, 1, 63, 0, 0, 132, 0, 0, 63, 1, 63, 175, 0, 135, 7, 11, 0, 63, 0, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 97, 5, 85, 46, 7, 0, 1, 63, 0, 0, 85, 14, 63, 0, 82, 6, 12, 0, 82, 63, 11, 0, 45, 63, 6, 63, 168, 17, 0, 0, 1, 63, 0, 0, 132, 0, 0, 63, 135, 63, 2, 0, 54, 10, 46, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 7, 0, 1, 53, 90, 0, 119, 0, 78, 5, 85, 6, 7, 0, 82, 63, 12, 0, 25, 63, 63, 4, 85, 12, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 82, 62, 15, 0, 82, 62, 62, 0, 135, 63, 2, 0, 62, 15, 7, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 223, 4, 1, 53, 90, 0, 119, 0, 60, 5, 82, 7, 20, 0, 1, 63, 0, 0, 132, 0, 0, 63, 135, 6, 11, 0, 55, 7, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 47, 5, 1, 63, 0, 0, 132, 0, 0, 63, 1, 63, 176, 0, 33, 61, 6, 0, 125, 62, 61, 6, 7, 0, 0, 0, 135, 7, 11, 0, 63, 62, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 31, 5, 121, 7, 51, 0, 1, 62, 0, 0, 132, 0, 0, 62, 1, 62, 177, 0, 135, 7, 11, 0, 62, 0, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 17, 5, 85, 45, 7, 0, 1, 62, 0, 0, 85, 14, 62, 0, 82, 6, 12, 0, 82, 62, 11, 0, 45, 62, 6, 62, 232, 18, 0, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 62, 2, 0, 54, 10, 45, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 7, 0, 1, 53, 90, 0, 119, 0, 254, 4, 85, 6, 7, 0, 82, 62, 12, 0, 25, 62, 62, 4, 85, 12, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 82, 63, 15, 0, 82, 63, 63, 0, 135, 62, 2, 0, 63, 15, 7, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 143, 4, 1, 53, 90, 0, 119, 0, 236, 4, 82, 7, 20, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 6, 11, 0, 55, 7, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 223, 4, 1, 62, 0, 0, 132, 0, 0, 62, 1, 62, 178, 0, 33, 61, 6, 0, 125, 63, 61, 6, 7, 0, 0, 0, 135, 7, 11, 0, 62, 63, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 207, 4, 121, 7, 51, 0, 1, 63, 0, 0, 132, 0, 0, 63, 1, 63, 179, 0, 135, 7, 11, 0, 63, 0, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 193, 4, 85, 44, 7, 0, 1, 63, 0, 0, 85, 14, 63, 0, 82, 6, 12, 0, 82, 63, 11, 0, 45, 63, 6, 63, 40, 20, 0, 0, 1, 63, 0, 0, 132, 0, 0, 63, 135, 63, 2, 0, 54, 10, 44, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 7, 0, 1, 53, 90, 0, 119, 0, 174, 4, 85, 6, 7, 0, 82, 63, 12, 0, 25, 63, 63, 4, 85, 12, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 82, 62, 15, 0, 82, 62, 62, 0, 135, 63, 2, 0, 62, 15, 7, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 63, 4, 1, 53, 90, 0, 119, 0, 156, 4, 82, 7, 20, 0, 1, 63, 0, 0, 132, 0, 0, 63, 135, 6, 11, 0, 55, 7, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 143, 4, 1, 63, 0, 0, 132, 0, 0, 63, 1, 63, 180, 0, 33, 61, 6, 0, 125, 62, 61, 6, 7, 0, 0, 0, 135, 7, 11, 0, 63, 62, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 127, 4, 121, 7, 51, 0, 1, 62, 0, 0, 132, 0, 0, 62, 1, 62, 181, 0, 135, 7, 11, 0, 62, 0, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 113, 4, 85, 43, 7, 0, 1, 62, 0, 0, 85, 14, 62, 0, 82, 6, 12, 0, 82, 62, 11, 0, 45, 62, 6, 62, 104, 21, 0, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 62, 2, 0, 54, 10, 43, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 7, 0, 1, 53, 90, 0, 119, 0, 94, 4, 85, 6, 7, 0, 82, 62, 12, 0, 25, 62, 62, 4, 85, 12, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 82, 63, 15, 0, 82, 63, 63, 0, 135, 62, 2, 0, 63, 15, 7, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 239, 3, 1, 53, 90, 0, 119, 0, 76, 4, 82, 7, 20, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 6, 11, 0, 55, 7, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 63, 4, 1, 62, 0, 0, 132, 0, 0, 62, 1, 62, 182, 0, 33, 61, 6, 0, 125, 63, 61, 6, 7, 0, 0, 0, 135, 7, 11, 0, 62, 63, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 47, 4, 121, 7, 51, 0, 1, 63, 0, 0, 132, 0, 0, 63, 1, 63, 183, 0, 135, 7, 11, 0, 63, 0, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 33, 4, 85, 42, 7, 0, 1, 63, 0, 0, 85, 14, 63, 0, 82, 6, 12, 0, 82, 63, 11, 0, 45, 63, 6, 63, 168, 22, 0, 0, 1, 63, 0, 0, 132, 0, 0, 63, 135, 63, 2, 0, 54, 10, 42, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 7, 0, 1, 53, 90, 0, 119, 0, 14, 4, 85, 6, 7, 0, 82, 63, 12, 0, 25, 63, 63, 4, 85, 12, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 82, 62, 15, 0, 82, 62, 62, 0, 135, 63, 2, 0, 62, 15, 7, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 159, 3, 1, 53, 90, 0, 119, 0, 252, 3, 82, 7, 20, 0, 1, 63, 0, 0, 132, 0, 0, 63, 135, 6, 11, 0, 55, 7, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 239, 3, 1, 63, 0, 0, 132, 0, 0, 63, 1, 63, 184, 0, 33, 61, 6, 0, 125, 62, 61, 6, 7, 0, 0, 0, 135, 7, 11, 0, 63, 62, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 223, 3, 121, 7, 51, 0, 1, 62, 0, 0, 132, 0, 0, 62, 1, 62, 185, 0, 135, 7, 11, 0, 62, 0, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 209, 3, 85, 39, 7, 0, 1, 62, 0, 0, 85, 14, 62, 0, 82, 6, 12, 0, 82, 62, 11, 0, 45, 62, 6, 62, 232, 23, 0, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 62, 2, 0, 54, 10, 39, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 7, 0, 1, 53, 90, 0, 119, 0, 190, 3, 85, 6, 7, 0, 82, 62, 12, 0, 25, 62, 62, 4, 85, 12, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 82, 63, 15, 0, 82, 63, 63, 0, 135, 62, 2, 0, 63, 15, 7, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 79, 3, 1, 53, 90, 0, 119, 0, 172, 3, 82, 7, 20, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 6, 11, 0, 55, 7, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 159, 3, 1, 62, 0, 0, 132, 0, 0, 62, 1, 62, 186, 0, 33, 61, 6, 0, 125, 63, 61, 6, 7, 0, 0, 0, 135, 7, 11, 0, 62, 63, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 143, 3, 121, 7, 66, 0, 1, 63, 0, 0, 132, 0, 0, 63, 1, 63, 187, 0, 135, 7, 11, 0, 63, 0, 0, 0, 130, 63, 0, 0, 0, 53, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 53, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 129, 3, 85, 34, 7, 0, 1, 63, 0, 0, 85, 14, 63, 0, 82, 6, 12, 0, 82, 63, 11, 0, 45, 63, 6, 63, 40, 25, 0, 0, 1, 63, 0, 0, 132, 0, 0, 63, 135, 63, 2, 0, 54, 10, 34, 0, 130, 63, 0, 0, 0, 53, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 53, 1, 121, 63, 7, 0, 1, 53, 90, 0, 119, 0, 110, 3, 85, 6, 7, 0, 82, 63, 12, 0, 25, 63, 63, 4, 85, 12, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 82, 62, 15, 0, 82, 62, 62, 0, 135, 63, 2, 0, 62, 15, 7, 0, 130, 63, 0, 0, 0, 53, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 53, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 92, 3, 1, 63, 0, 0, 132, 0, 0, 63, 1, 62, 168, 123, 135, 63, 15, 0, 59, 52, 62, 0, 130, 63, 0, 0, 0, 53, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 53, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 79, 3, 1, 53, 13, 1, 119, 0, 238, 2, 82, 7, 20, 0, 1, 63, 0, 0, 132, 0, 0, 63, 135, 6, 11, 0, 55, 7, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 64, 3, 1, 63, 0, 0, 132, 0, 0, 63, 1, 63, 188, 0, 33, 61, 6, 0, 125, 62, 61, 6, 7, 0, 0, 0, 135, 7, 11, 0, 63, 62, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 48, 3, 121, 7, 66, 0, 1, 62, 0, 0, 132, 0, 0, 62, 1, 62, 189, 0, 135, 7, 11, 0, 62, 0, 0, 0, 130, 62, 0, 0, 0, 53, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 53, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 34, 3, 85, 26, 7, 0, 1, 62, 0, 0, 85, 14, 62, 0, 82, 6, 12, 0, 82, 62, 11, 0, 45, 62, 6, 62, 164, 26, 0, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 62, 2, 0, 54, 10, 26, 0, 130, 62, 0, 0, 0, 53, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 53, 1, 121, 62, 7, 0, 1, 53, 90, 0, 119, 0, 15, 3, 85, 6, 7, 0, 82, 62, 12, 0, 25, 62, 62, 4, 85, 12, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 82, 63, 15, 0, 82, 63, 63, 0, 135, 62, 2, 0, 63, 15, 7, 0, 130, 62, 0, 0, 0, 53, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 53, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 253, 2, 1, 62, 0, 0, 132, 0, 0, 62, 1, 63, 224, 123, 135, 62, 15, 0, 59, 52, 63, 0, 130, 62, 0, 0, 0, 53, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 53, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 240, 2, 1, 53, 13, 1, 119, 0, 143, 2, 82, 7, 20, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 6, 11, 0, 55, 7, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 225, 2, 1, 62, 0, 0, 132, 0, 0, 62, 33, 63, 6, 0, 125, 62, 63, 6, 7, 0, 0, 0, 135, 7, 11, 0, 57, 62, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 210, 2, 1, 62, 0, 0, 132, 0, 0, 62, 121, 7, 63, 0, 135, 7, 16, 0, 0, 0, 0, 0, 130, 62, 0, 0, 0, 53, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 53, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 197, 2, 85, 25, 7, 0, 1, 62, 0, 0, 85, 14, 62, 0, 82, 6, 12, 0, 82, 62, 11, 0, 45, 62, 6, 62, 24, 28, 0, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 62, 2, 0, 54, 10, 25, 0, 130, 62, 0, 0, 0, 53, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 53, 1, 121, 62, 7, 0, 1, 53, 90, 0, 119, 0, 178, 2, 85, 6, 7, 0, 82, 62, 12, 0, 25, 62, 62, 4, 85, 12, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 82, 63, 15, 0, 82, 63, 63, 0, 135, 62, 2, 0, 63, 15, 7, 0, 130, 62, 0, 0, 0, 53, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 53, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 160, 2, 1, 62, 0, 0, 132, 0, 0, 62, 1, 63, 24, 124, 135, 62, 15, 0, 59, 52, 63, 0, 130, 62, 0, 0, 0, 53, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 53, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 147, 2, 1, 53, 13, 1, 119, 0, 50, 2, 1, 62, 1, 0, 135, 7, 17, 0, 0, 62, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 134, 2, 121, 7, 29, 0, 1, 62, 0, 0, 132, 0, 0, 62, 1, 63, 22, 3, 1, 61, 1, 0, 135, 62, 15, 0, 63, 0, 61, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 119, 2, 1, 62, 0, 0, 132, 0, 0, 62, 1, 61, 23, 3, 1, 63, 1, 0, 135, 62, 15, 0, 61, 0, 63, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 12, 2, 1, 53, 90, 0, 119, 0, 105, 2, 82, 7, 20, 0, 1, 62, 0, 0, 132, 0, 0, 62, 135, 6, 11, 0, 55, 7, 0, 0, 130, 62, 0, 0, 0, 13, 62, 0, 1, 62, 0, 0, 132, 0, 0, 62, 38, 62, 13, 1, 121, 62, 3, 0, 1, 53, 90, 0, 119, 0, 92, 2, 1, 62, 0, 0, 132, 0, 0, 62, 1, 62, 191, 0, 33, 61, 6, 0, 125, 63, 61, 6, 7, 0, 0, 0, 135, 7, 11, 0, 62, 63, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 76, 2, 121, 7, 68, 0, 1, 63, 0, 0, 132, 0, 0, 63, 1, 63, 192, 0, 135, 7, 11, 0, 63, 0, 0, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 62, 2, 85, 48, 7, 0, 1, 63, 0, 0, 85, 14, 63, 0, 82, 6, 12, 0, 82, 63, 11, 0, 45, 63, 6, 63, 52, 30, 0, 0, 1, 63, 0, 0, 132, 0, 0, 63, 135, 63, 2, 0, 54, 10, 48, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 7, 0, 1, 53, 90, 0, 119, 0, 43, 2, 85, 6, 7, 0, 82, 63, 12, 0, 25, 63, 63, 4, 85, 12, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 82, 62, 15, 0, 82, 62, 62, 0, 135, 63, 2, 0, 62, 15, 7, 0, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 25, 2, 106, 63, 7, 68, 120, 63, 184, 1, 1, 63, 0, 0, 132, 0, 0, 63, 1, 62, 80, 124, 135, 63, 15, 0, 59, 52, 62, 0, 130, 63, 0, 0, 0, 53, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 53, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 10, 2, 1, 53, 13, 1, 119, 0, 169, 1, 1, 63, 0, 0, 132, 0, 0, 63, 1, 62, 191, 0, 82, 61, 20, 0, 135, 63, 12, 0, 62, 36, 0, 61, 130, 63, 0, 0, 0, 13, 63, 0, 1, 63, 0, 0, 132, 0, 0, 63, 38, 63, 13, 1, 121, 63, 3, 0, 1, 53, 90, 0, 119, 0, 250, 1, 82, 7, 36, 0, 121, 7, 57, 0, 82, 13, 17, 0, 85, 37, 7, 0, 85, 16, 13, 0, 1, 63, 0, 0, 132, 0, 0, 63, 116, 48, 37, 0, 106, 61, 37, 4, 109, 48, 4, 61, 1, 61, 24, 3, 135, 7, 15, 0, 61, 0, 48, 0, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 3, 0, 1, 53, 90, 0, 119, 0, 229, 1, 85, 32, 7, 0, 1, 61, 0, 0, 85, 14, 61, 0, 82, 6, 12, 0, 82, 61, 11, 0, 45, 61, 6, 61, 152, 31, 0, 0, 1, 61, 0, 0, 132, 0, 0, 61, 135, 61, 2, 0, 54, 10, 32, 0, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 7, 0, 1, 53, 90, 0, 119, 0, 210, 1, 85, 6, 7, 0, 82, 61, 12, 0, 25, 61, 61, 4, 85, 12, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 82, 63, 15, 0, 82, 63, 63, 0, 135, 61, 2, 0, 63, 15, 7, 0, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 99, 1, 1, 53, 90, 0, 119, 0, 192, 1, 82, 7, 20, 0, 1, 61, 0, 0, 132, 0, 0, 61, 135, 6, 11, 0, 55, 7, 0, 0, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 3, 0, 1, 53, 90, 0, 119, 0, 179, 1, 1, 61, 0, 0, 132, 0, 0, 61, 33, 63, 6, 0, 125, 61, 63, 6, 7, 0, 0, 0, 78, 61, 61, 0, 32, 61, 61, 59, 121, 61, 12, 0, 1, 63, 1, 0, 135, 61, 18, 0, 0, 63, 0, 0, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 67, 1, 1, 53, 90, 0, 119, 0, 160, 1, 1, 63, 1, 0, 135, 61, 19, 0, 0, 63, 0, 0, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 3, 0, 1, 53, 90, 0, 119, 0, 149, 1, 82, 61, 19, 0, 82, 63, 20, 0, 50, 61, 61, 63, 164, 32, 0, 0, 1, 53, 25, 1, 119, 0, 143, 1, 1, 61, 0, 0, 132, 0, 0, 61, 1, 63, 136, 0, 1, 62, 128, 124, 1, 60, 28, 0, 135, 61, 12, 0, 63, 38, 62, 60, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 3, 0, 1, 53, 90, 0, 119, 0, 128, 1, 1, 61, 0, 0, 132, 0, 0, 61, 116, 48, 18, 0, 106, 60, 18, 4, 109, 48, 4, 60, 106, 61, 18, 8, 109, 48, 8, 61, 1, 60, 192, 0, 135, 61, 12, 0, 60, 0, 38, 48, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 3, 0, 1, 53, 12, 1, 119, 0, 110, 1, 135, 61, 5, 0, 38, 0, 0, 0, 119, 0, 12, 1, 1, 61, 0, 0, 132, 0, 0, 61, 1, 61, 168, 0, 135, 7, 11, 0, 61, 0, 0, 0, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 3, 0, 1, 53, 90, 0, 119, 0, 94, 1, 85, 29, 7, 0, 1, 61, 0, 0, 85, 14, 61, 0, 82, 6, 12, 0, 82, 61, 11, 0, 45, 61, 6, 61, 180, 33, 0, 0, 1, 61, 0, 0, 132, 0, 0, 61, 135, 61, 2, 0, 54, 10, 29, 0, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 7, 0, 1, 53, 90, 0, 119, 0, 75, 1, 85, 6, 7, 0, 82, 61, 12, 0, 25, 61, 61, 4, 85, 12, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 82, 60, 15, 0, 82, 60, 60, 0, 135, 61, 2, 0, 60, 15, 7, 0, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 220, 0, 1, 53, 90, 0, 119, 0, 57, 1, 1, 61, 0, 0, 132, 0, 0, 61, 1, 61, 165, 0, 135, 6, 11, 0, 61, 0, 0, 0, 130, 61, 0, 0, 0, 53, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 53, 1, 121, 61, 3, 0, 1, 53, 90, 0, 119, 0, 44, 1, 106, 61, 6, 80, 106, 60, 6, 84, 46, 61, 61, 60, 212, 34, 0, 0, 85, 33, 6, 0, 1, 61, 0, 0, 85, 14, 61, 0, 82, 7, 12, 0, 82, 61, 11, 0, 45, 61, 7, 61, 140, 34, 0, 0, 1, 61, 0, 0, 132, 0, 0, 61, 135, 61, 2, 0, 54, 10, 33, 0, 130, 61, 0, 0, 0, 53, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 53, 1, 121, 61, 7, 0, 1, 53, 90, 0, 119, 0, 21, 1, 85, 7, 6, 0, 82, 61, 12, 0, 25, 61, 61, 4, 85, 12, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 82, 60, 15, 0, 82, 60, 60, 0, 135, 61, 2, 0, 60, 15, 6, 0, 130, 61, 0, 0, 0, 53, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 53, 1, 121, 61, 3, 0, 1, 53, 90, 0, 119, 0, 3, 1, 25, 13, 6, 68, 82, 5, 13, 0, 106, 7, 6, 72, 46, 61, 5, 7, 40, 37, 0, 0, 4, 61, 7, 5, 28, 2, 61, 12, 1, 1, 0, 0, 82, 7, 41, 0, 25, 4, 7, 4, 1, 61, 0, 0, 132, 0, 0, 61, 1, 61, 131, 0, 1, 60, 80, 0, 135, 5, 11, 0, 61, 60, 0, 0, 130, 60, 0, 0, 0, 53, 60, 0, 1, 60, 0, 0, 132, 0, 0, 60, 38, 60, 53, 1, 121, 60, 3, 0, 1, 53, 89, 0, 119, 0, 235, 0, 85, 31, 5, 0, 25, 3, 7, 8, 82, 6, 3, 0, 106, 60, 7, 12, 45, 60, 6, 60, 128, 35, 0, 0, 1, 60, 0, 0, 132, 0, 0, 60, 1, 61, 141, 1, 135, 60, 2, 0, 61, 4, 31, 0, 130, 60, 0, 0, 0, 53, 60, 0, 1, 60, 0, 0, 132, 0, 0, 60, 38, 60, 53, 1, 121, 60, 7, 0, 1, 53, 89, 0, 119, 0, 216, 0, 85, 6, 5, 0, 82, 60, 3, 0, 25, 60, 60, 4, 85, 3, 60, 0, 116, 35, 22, 0, 106, 61, 22, 4, 109, 35, 4, 61, 106, 60, 22, 8, 109, 35, 8, 60, 1, 60, 0, 0, 132, 0, 0, 60, 135, 60, 2, 0, 56, 8, 23, 0, 130, 60, 0, 0, 0, 53, 60, 0, 1, 60, 0, 0, 132, 0, 0, 60, 38, 60, 53, 1, 121, 60, 3, 0, 1, 53, 107, 0, 119, 0, 195, 0, 116, 9, 24, 0, 106, 61, 24, 4, 109, 9, 4, 61, 106, 60, 24, 8, 109, 9, 8, 60, 106, 61, 24, 12, 109, 9, 12, 61, 106, 60, 24, 16, 109, 9, 16, 60, 106, 61, 24, 20, 109, 9, 20, 61, 1, 61, 0, 0, 132, 0, 0, 61, 82, 60, 13, 0, 27, 62, 1, 12, 3, 60, 60, 62, 135, 61, 2, 0, 56, 50, 60, 0, 130, 61, 0, 0, 0, 53, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 53, 1, 121, 61, 3, 0, 1, 53, 108, 0, 119, 0, 169, 0, 1, 61, 0, 0, 132, 0, 0, 61, 135, 61, 12, 0, 57, 5, 35, 50, 130, 61, 0, 0, 0, 53, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 53, 1, 121, 61, 4, 0, 1, 6, 1, 0, 1, 53, 109, 0, 119, 0, 156, 0, 85, 30, 5, 0, 1, 61, 0, 0, 85, 14, 61, 0, 82, 7, 12, 0, 82, 61, 11, 0, 45, 61, 7, 61, 192, 36, 0, 0, 1, 61, 0, 0, 132, 0, 0, 61, 135, 61, 2, 0, 54, 10, 30, 0, 130, 61, 0, 0, 0, 53, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 53, 1, 121, 61, 8, 0, 1, 6, 0, 0, 1, 53, 109, 0, 119, 0, 136, 0, 85, 7, 5, 0, 82, 61, 12, 0, 25, 61, 61, 4, 85, 12, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 82, 60, 15, 0, 82, 60, 60, 0, 135, 61, 2, 0, 60, 15, 5, 0, 130, 61, 0, 0, 0, 53, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 53, 1, 121, 61, 4, 0, 1, 6, 0, 0, 1, 53, 109, 0, 119, 0, 117, 0, 135, 61, 5, 0, 50, 0, 0, 0, 135, 61, 5, 0, 8, 0, 0, 0, 25, 1, 1, 1, 55, 61, 1, 2, 244, 34, 0, 0, 1, 61, 0, 0, 132, 0, 0, 61, 1, 60, 0, 123, 135, 61, 15, 0, 59, 52, 60, 0, 130, 61, 0, 0, 0, 53, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 53, 1, 121, 61, 3, 0, 1, 53, 90, 0, 119, 0, 97, 0, 1, 53, 13, 1, 45, 61, 53, 58, 164, 38, 0, 0, 1, 53, 0, 0, 1, 61, 0, 0, 132, 0, 0, 61, 1, 61, 23, 3, 1, 60, 1, 0, 135, 7, 15, 0, 61, 0, 60, 0, 130, 60, 0, 0, 0, 13, 60, 0, 1, 60, 0, 0, 132, 0, 0, 60, 38, 60, 13, 1, 121, 60, 3, 0, 1, 53, 90, 0, 119, 0, 79, 0, 120, 7, 64, 0, 1, 60, 0, 0, 132, 0, 0, 60, 1, 60, 163, 0, 82, 61, 20, 0, 135, 7, 11, 0, 60, 61, 0, 0, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 3, 0, 1, 53, 90, 0, 119, 0, 64, 0, 120, 7, 2, 0, 82, 7, 20, 0, 1, 61, 0, 0, 132, 0, 0, 61, 135, 7, 11, 0, 55, 7, 0, 0, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 3, 0, 1, 53, 90, 0, 119, 0, 50, 0, 82, 61, 19, 0, 52, 61, 7, 61, 164, 38, 0, 0, 1, 61, 0, 0, 132, 0, 0, 61, 135, 61, 2, 0, 56, 40, 52, 0, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 3, 0, 1, 53, 90, 0, 119, 0, 35, 0, 1, 61, 0, 0, 132, 0, 0, 61, 116, 48, 22, 0, 106, 60, 22, 4, 109, 48, 4, 60, 106, 61, 22, 8, 109, 48, 8, 61, 1, 60, 192, 0, 135, 61, 12, 0, 60, 0, 40, 48, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 3, 0, 1, 53, 23, 1, 119, 0, 17, 0, 135, 61, 5, 0, 40, 0, 0, 0, 1, 61, 0, 0, 132, 0, 0, 61, 1, 60, 20, 3, 1, 62, 1, 0, 135, 61, 15, 0, 60, 0, 62, 0, 130, 61, 0, 0, 0, 13, 61, 0, 1, 61, 0, 0, 132, 0, 0, 61, 38, 61, 13, 1, 121, 61, 250, 248, 1, 53, 90, 0, 119, 0, 1, 0, 32, 61, 53, 89, 121, 61, 4, 0, 135, 1, 3, 0, 1, 53, 92, 0, 119, 0, 100, 0, 32, 61, 53, 90, 121, 61, 4, 0, 135, 1, 3, 0, 1, 53, 92, 0, 119, 0, 95, 0, 32, 61, 53, 107, 121, 61, 7, 0, 135, 1, 3, 0, 128, 61, 0, 0, 0, 2, 61, 0, 0, 7, 3, 0, 0, 6, 5, 0, 119, 0, 48, 0, 32, 61, 53, 108, 121, 61, 9, 0, 135, 1, 3, 0, 128, 61, 0, 0, 0, 2, 61, 0, 135, 61, 5, 0, 8, 0, 0, 0, 0, 7, 3, 0, 0, 6, 5, 0, 119, 0, 38, 0, 32, 61, 53, 109, 121, 61, 12, 0, 135, 1, 3, 0, 128, 61, 0, 0, 0, 2, 61, 0, 135, 61, 5, 0, 50, 0, 0, 0, 135, 61, 5, 0, 8, 0, 0, 0, 121, 6, 67, 0, 0, 7, 3, 0, 0, 6, 5, 0, 119, 0, 25, 0, 1, 61, 12, 1, 45, 61, 53, 61, 156, 39, 0, 0, 135, 1, 3, 0, 135, 61, 5, 0, 38, 0, 0, 0, 119, 0, 57, 0, 1, 61, 23, 1, 45, 61, 53, 61, 184, 39, 0, 0, 135, 1, 3, 0, 135, 61, 5, 0, 40, 0, 0, 0, 119, 0, 50, 0, 1, 61, 25, 1, 45, 61, 53, 61, 224, 39, 0, 0, 82, 61, 21, 0, 26, 61, 61, 4, 85, 21, 61, 0, 135, 61, 5, 0, 52, 0, 0, 0, 137, 49, 0, 0, 139, 51, 0, 0, 82, 5, 4, 0, 82, 3, 7, 0, 45, 61, 5, 3, 248, 39, 0, 0, 0, 4, 5, 0, 119, 0, 11, 0, 0, 4, 5, 0, 82, 61, 4, 0], eb + 0);
  HEAPU8.set([52, 61, 61, 6, 32, 40, 0, 0, 25, 4, 4, 4, 45, 61, 4, 3, 28, 40, 0, 0, 0, 4, 3, 0, 119, 0, 2, 0, 119, 0, 248, 255, 4, 61, 4, 5, 42, 61, 61, 2, 25, 61, 61, 1, 41, 61, 61, 2, 3, 51, 5, 61, 4, 3, 3, 51, 135, 61, 13, 0, 4, 51, 3, 0, 42, 61, 3, 2, 41, 61, 61, 2, 3, 4, 4, 61, 82, 3, 7, 0, 46, 61, 3, 4, 116, 40, 0, 0, 26, 61, 3, 4, 4, 61, 61, 4, 43, 61, 61, 2, 11, 61, 61, 0, 41, 61, 61, 2, 3, 61, 3, 61, 85, 7, 61, 0, 135, 61, 10, 0, 6, 0, 0, 0, 135, 61, 5, 0, 52, 0, 0, 0, 0, 53, 1, 0, 135, 61, 14, 0, 53, 0, 0, 0, 82, 3, 3, 0, 82, 1, 12, 0, 45, 61, 3, 1, 168, 40, 0, 0, 0, 2, 3, 0, 119, 0, 11, 0, 0, 2, 3, 0, 82, 61, 2, 0, 52, 61, 61, 51, 208, 40, 0, 0, 25, 2, 2, 4, 45, 61, 2, 1, 204, 40, 0, 0, 0, 2, 1, 0, 119, 0, 2, 0, 119, 0, 248, 255, 4, 61, 2, 3, 42, 61, 61, 2, 25, 61, 61, 1, 41, 61, 61, 2, 3, 53, 3, 61, 4, 1, 1, 53, 135, 61, 13, 0, 2, 53, 1, 0, 42, 61, 1, 2, 41, 61, 61, 2, 3, 1, 2, 61, 82, 2, 12, 0, 46, 61, 2, 1, 36, 41, 0, 0, 26, 61, 2, 4, 4, 61, 61, 1, 43, 61, 61, 2, 11, 61, 61, 0, 41, 61, 61, 2, 3, 61, 2, 61, 85, 12, 61, 0, 135, 61, 10, 0, 51, 0, 0, 0, 0, 53, 5, 0, 135, 61, 14, 0, 53, 0, 0, 0, 1, 61, 0, 0, 139, 61, 0, 0, 140, 1, 72, 0, 0, 0, 0, 0, 2, 61, 0, 0, 147, 0, 0, 0, 2, 62, 0, 0, 144, 1, 0, 0, 2, 63, 0, 0, 136, 0, 0, 0, 2, 64, 0, 0, 189, 1, 0, 0, 2, 65, 0, 0, 8, 208, 0, 0, 2, 66, 0, 0, 145, 0, 0, 0, 2, 67, 0, 0, 146, 0, 0, 0, 1, 60, 0, 0, 136, 68, 0, 0, 0, 48, 68, 0, 136, 68, 0, 0, 1, 69, 208, 1, 3, 68, 68, 69, 137, 68, 0, 0, 1, 68, 136, 1, 3, 47, 48, 68, 1, 68, 248, 0, 3, 33, 48, 68, 1, 68, 184, 0, 3, 34, 48, 68, 25, 7, 48, 72, 1, 68, 112, 1, 3, 54, 48, 68, 25, 49, 48, 24, 25, 43, 48, 36, 1, 68, 8, 1, 3, 44, 48, 68, 1, 68, 64, 1, 3, 45, 48, 68, 1, 68, 124, 1, 3, 50, 48, 68, 1, 68, 152, 1, 3, 46, 48, 68, 25, 55, 48, 120, 3, 35, 48, 63, 1, 68, 188, 0, 3, 56, 48, 68, 1, 68, 200, 0, 3, 36, 48, 68, 0, 57, 48, 0, 1, 68, 252, 0, 3, 37, 48, 68, 25, 38, 48, 48, 1, 68, 56, 1, 3, 39, 48, 68, 25, 40, 48, 12, 25, 41, 48, 60, 1, 69, 1, 0, 135, 68, 20, 0, 0, 69, 0, 0, 25, 42, 0, 48, 82, 58, 42, 0, 25, 6, 58, 4, 1, 68, 92, 0, 135, 59, 0, 0, 68, 0, 0, 0, 85, 47, 59, 0, 25, 9, 58, 8, 82, 8, 9, 0, 106, 68, 58, 12, 45, 68, 8, 68, 104, 42, 0, 0, 135, 68, 1, 0, 6, 47, 0, 0, 119, 0, 5, 0, 85, 8, 59, 0, 82, 68, 9, 0, 25, 68, 68, 4, 85, 9, 68, 0, 25, 29, 0, 116, 116, 7, 29, 0, 106, 69, 29, 4, 109, 7, 4, 69, 106, 68, 29, 8, 109, 7, 8, 68, 25, 8, 7, 12, 1, 68, 128, 0, 3, 30, 0, 68, 1, 68, 0, 0, 132, 0, 0, 68, 135, 68, 2, 0, 62, 8, 30, 0, 130, 68, 0, 0, 0, 58, 68, 0, 1, 68, 0, 0, 132, 0, 0, 68, 38, 68, 58, 1, 121, 68, 5, 0, 135, 5, 3, 0, 128, 68, 0, 0, 0, 3, 68, 0, 119, 0, 8, 6, 25, 58, 7, 24, 1, 68, 140, 0, 3, 31, 0, 68, 116, 58, 31, 0, 106, 69, 31, 4, 109, 58, 4, 69, 106, 68, 31, 8, 109, 58, 8, 68, 106, 69, 31, 12, 109, 58, 12, 69, 106, 68, 31, 16, 109, 58, 16, 68, 106, 69, 31, 20, 109, 58, 20, 69, 1, 69, 0, 0, 132, 0, 0, 69, 1, 68, 205, 1, 135, 69, 2, 0, 68, 59, 7, 0, 130, 69, 0, 0, 0, 58, 69, 0, 1, 69, 0, 0, 132, 0, 0, 69, 38, 69, 58, 1, 121, 69, 7, 0, 135, 5, 3, 0, 128, 69, 0, 0, 0, 3, 69, 0, 135, 69, 5, 0, 8, 0, 0, 0, 119, 0, 233, 5, 135, 69, 5, 0, 8, 0, 0, 0, 25, 28, 44, 12, 25, 10, 44, 24, 25, 58, 45, 12, 25, 11, 45, 24, 25, 12, 0, 84, 25, 51, 36, 12, 25, 13, 36, 24, 1, 69, 168, 0, 3, 14, 0, 69, 25, 52, 35, 12, 25, 15, 35, 24, 25, 16, 59, 84, 25, 17, 59, 88, 25, 18, 59, 80, 25, 53, 46, 12, 25, 19, 46, 24, 1, 69, 172, 0, 3, 20, 0, 69, 1, 69, 176, 0, 3, 21, 0, 69, 25, 22, 54, 8, 25, 23, 54, 4, 25, 24, 43, 8, 25, 25, 43, 4, 25, 26, 43, 1, 25, 32, 49, 4, 25, 27, 54, 1, 1, 9, 1, 0, 1, 68, 1, 0, 135, 69, 21, 0, 0, 68, 0, 0, 33, 69, 69, 0, 120, 69, 252, 255, 1, 68, 1, 0, 135, 69, 22, 0, 0, 68, 0, 0, 120, 69, 231, 2, 1, 68, 1, 0, 135, 69, 23, 0, 0, 68, 0, 0, 120, 69, 52, 0, 121, 9, 26, 0, 1, 68, 200, 125, 1, 70, 47, 0, 135, 69, 24, 0, 40, 68, 70, 0, 1, 69, 0, 0, 132, 0, 0, 69, 116, 47, 29, 0, 106, 70, 29, 4, 109, 47, 4, 70, 106, 69, 29, 8, 109, 47, 8, 69, 1, 70, 192, 0, 135, 69, 12, 0, 70, 0, 40, 47, 130, 69, 0, 0, 0, 9, 69, 0, 1, 69, 0, 0, 132, 0, 0, 69, 38, 69, 9, 1, 121, 69, 3, 0, 1, 60, 167, 0, 119, 0, 112, 3, 135, 69, 5, 0, 40, 0, 0, 0, 119, 0, 93, 3, 1, 70, 248, 125, 1, 68, 52, 0, 135, 69, 24, 0, 41, 70, 68, 0, 1, 69, 0, 0, 132, 0, 0, 69, 116, 47, 29, 0, 106, 68, 29, 4, 109, 47, 4, 68, 106, 69, 29, 8, 109, 47, 8, 69, 1, 68, 192, 0, 135, 69, 12, 0, 68, 0, 41, 47, 130, 69, 0, 0, 0, 9, 69, 0, 1, 69, 0, 0, 132, 0, 0, 69, 38, 69, 9, 1, 121, 69, 3, 0, 1, 60, 170, 0, 119, 0, 87, 3, 135, 69, 5, 0, 41, 0, 0, 0, 119, 0, 68, 3, 82, 8, 42, 0, 25, 3, 8, 4, 1, 69, 84, 0, 135, 2, 0, 0, 69, 0, 0, 0, 85, 47, 2, 0, 25, 4, 8, 8, 82, 9, 4, 0, 106, 69, 8, 12, 45, 69, 9, 69, 0, 45, 0, 0, 135, 69, 1, 0, 3, 47, 0, 0, 119, 0, 5, 0, 85, 9, 2, 0, 82, 69, 4, 0, 25, 69, 69, 4, 85, 4, 69, 0, 116, 44, 29, 0, 106, 68, 29, 4, 109, 44, 4, 68, 106, 69, 29, 8, 109, 44, 8, 69, 1, 69, 0, 0, 132, 0, 0, 69, 135, 69, 2, 0, 62, 28, 30, 0, 130, 69, 0, 0, 0, 9, 69, 0, 1, 69, 0, 0, 132, 0, 0, 69, 38, 69, 9, 1, 121, 69, 3, 0, 1, 60, 74, 0, 119, 0, 49, 3, 116, 10, 31, 0, 106, 68, 31, 4, 109, 10, 4, 68, 106, 69, 31, 8, 109, 10, 8, 69, 106, 68, 31, 12, 109, 10, 12, 68, 106, 69, 31, 16, 109, 10, 16, 69, 106, 68, 31, 20, 109, 10, 20, 68, 1, 68, 0, 0, 132, 0, 0, 68, 1, 69, 188, 1, 135, 68, 2, 0, 69, 2, 44, 0, 130, 68, 0, 0, 0, 9, 68, 0, 1, 68, 0, 0, 132, 0, 0, 68, 38, 68, 9, 1, 121, 68, 3, 0, 1, 60, 75, 0, 119, 0, 25, 3, 135, 68, 5, 0, 28, 0, 0, 0, 82, 8, 42, 0, 25, 3, 8, 4, 1, 68, 84, 0, 135, 1, 0, 0, 68, 0, 0, 0, 85, 47, 1, 0, 25, 4, 8, 8, 82, 9, 4, 0, 106, 68, 8, 12, 45, 68, 9, 68, 244, 45, 0, 0, 135, 68, 1, 0, 3, 47, 0, 0, 119, 0, 5, 0, 85, 9, 1, 0, 82, 68, 4, 0, 25, 68, 68, 4, 85, 4, 68, 0, 116, 45, 29, 0, 106, 69, 29, 4, 109, 45, 4, 69, 106, 68, 29, 8, 109, 45, 8, 68, 1, 68, 0, 0, 132, 0, 0, 68, 135, 68, 2, 0, 62, 58, 30, 0, 130, 68, 0, 0, 0, 9, 68, 0, 1, 68, 0, 0, 132, 0, 0, 68, 38, 68, 9, 1, 121, 68, 4, 0, 0, 2, 1, 0, 1, 60, 82, 0, 119, 0, 243, 2, 116, 11, 31, 0, 106, 69, 31, 4, 109, 11, 4, 69, 106, 68, 31, 8, 109, 11, 8, 68, 106, 69, 31, 12, 109, 11, 12, 69, 106, 68, 31, 16, 109, 11, 16, 68, 106, 69, 31, 20, 109, 11, 20, 69, 1, 69, 0, 0, 132, 0, 0, 69, 1, 68, 152, 125, 1, 70, 3, 0, 135, 69, 12, 0, 63, 50, 68, 70, 130, 69, 0, 0, 0, 9, 69, 0, 1, 69, 0, 0, 132, 0, 0, 69, 38, 69, 9, 1, 121, 69, 4, 0, 0, 2, 1, 0, 1, 60, 83, 0, 119, 0, 217, 2, 1, 69, 0, 0, 132, 0, 0, 69, 1, 70, 20, 0, 135, 69, 4, 0, 70, 1, 45, 50, 2, 0, 0, 0, 130, 69, 0, 0, 0, 9, 69, 0, 1, 69, 0, 0, 132, 0, 0, 69, 38, 69, 9, 1, 121, 69, 4, 0, 0, 2, 1, 0, 1, 60, 84, 0, 119, 0, 202, 2, 135, 69, 5, 0, 50, 0, 0, 0, 135, 69, 5, 0, 58, 0, 0, 0, 1, 70, 1, 0, 135, 69, 22, 0, 0, 70, 0, 0, 120, 69, 107, 1, 82, 70, 12, 0, 33, 70, 70, 0, 135, 69, 25, 0, 0, 70, 0, 0, 121, 69, 137, 0, 116, 47, 14, 0, 106, 70, 14, 4, 109, 47, 4, 70, 106, 69, 14, 8, 109, 47, 8, 69, 1, 69, 0, 0, 135, 9, 26, 0, 0, 47, 69, 0, 25, 7, 2, 60, 82, 5, 42, 0, 25, 3, 5, 4, 1, 69, 84, 0, 135, 6, 0, 0, 69, 0, 0, 0, 85, 47, 6, 0, 25, 4, 5, 8, 82, 8, 4, 0, 106, 69, 5, 12, 45, 69, 8, 69, 128, 47, 0, 0, 135, 69, 1, 0, 3, 47, 0, 0, 119, 0, 5, 0, 85, 8, 6, 0, 82, 69, 4, 0, 25, 69, 69, 4, 85, 4, 69, 0, 25, 8, 9, 4, 116, 35, 8, 0, 106, 70, 8, 4, 109, 35, 4, 70, 106, 69, 8, 8, 109, 35, 8, 69, 1, 69, 0, 0, 132, 0, 0, 69, 25, 70, 9, 16, 135, 69, 2, 0, 62, 52, 70, 0, 130, 69, 0, 0, 0, 8, 69, 0, 1, 69, 0, 0, 132, 0, 0, 69, 38, 69, 8, 1, 121, 69, 4, 0, 0, 2, 6, 0, 1, 60, 113, 0, 119, 0, 142, 2, 25, 8, 9, 28, 116, 15, 8, 0, 106, 70, 8, 4, 109, 15, 4, 70, 106, 69, 8, 8, 109, 15, 8, 69, 106, 70, 8, 12, 109, 15, 12, 70, 106, 69, 8, 16, 109, 15, 16, 69, 106, 70, 8, 20, 109, 15, 20, 70, 1, 70, 0, 0, 132, 0, 0, 70, 1, 69, 0, 0, 135, 70, 12, 0, 63, 56, 65, 69, 130, 70, 0, 0, 0, 8, 70, 0, 1, 70, 0, 0, 132, 0, 0, 70, 38, 70, 8, 1, 121, 70, 4, 0, 0, 2, 6, 0, 1, 60, 114, 0, 119, 0, 116, 2, 1, 70, 0, 0, 132, 0, 0, 70, 1, 69, 10, 0, 1, 68, 0, 0, 1, 71, 0, 0, 135, 70, 27, 0, 69, 6, 35, 9, 56, 68, 71, 0, 130, 70, 0, 0, 0, 9, 70, 0, 1, 70, 0, 0, 132, 0, 0, 70, 38, 70, 9, 1, 121, 70, 4, 0, 1, 5, 1, 0, 1, 60, 115, 0, 119, 0, 99, 2, 85, 33, 6, 0, 1, 71, 0, 0, 109, 2, 76, 71, 25, 9, 2, 68, 82, 8, 9, 0, 106, 71, 2, 72, 45, 71, 8, 71, 228, 48, 0, 0, 1, 71, 0, 0, 132, 0, 0, 71, 25, 70, 2, 64, 135, 71, 2, 0, 64, 70, 33, 0, 130, 71, 0, 0, 0, 9, 71, 0, 1, 71, 0, 0, 132, 0, 0, 71, 38, 71, 9, 1, 121, 71, 8, 0, 1, 5, 0, 0, 1, 60, 115, 0, 119, 0, 77, 2, 85, 8, 6, 0, 82, 71, 9, 0, 25, 71, 71, 4, 85, 9, 71, 0, 1, 71, 0, 0, 132, 0, 0, 71, 82, 70, 7, 0, 82, 70, 70, 0, 135, 71, 2, 0, 70, 7, 6, 0, 130, 71, 0, 0, 0, 9, 71, 0, 1, 71, 0, 0, 132, 0, 0, 71, 38, 71, 9, 1, 121, 71, 4, 0, 1, 5, 0, 0, 1, 60, 115, 0, 119, 0, 58, 2, 135, 71, 5, 0, 56, 0, 0, 0, 135, 71, 5, 0, 52, 0, 0, 0, 119, 0, 104, 1, 82, 9, 12, 0, 135, 8, 28, 0, 9, 0, 0, 0, 33, 71, 8, 0, 125, 9, 71, 8, 9, 0, 0, 0, 78, 8, 9, 0, 41, 71, 8, 24, 42, 71, 71, 24, 121, 71, 187, 0, 1, 7, 0, 0, 1, 6, 0, 0, 1, 5, 0, 0, 41, 71, 8, 24, 42, 71, 71, 24, 32, 71, 71, 92, 121, 71, 3, 0, 25, 9, 9, 1, 119, 0, 42, 0, 41, 71, 8, 24, 42, 71, 71, 24, 32, 71, 71, 34, 121, 71, 4, 0, 40, 71, 7, 1, 0, 7, 71, 0, 119, 0, 35, 0, 41, 71, 8, 24, 42, 71, 71, 24, 32, 71, 71, 39, 121, 71, 4, 0, 40, 71, 6, 1, 0, 6, 71, 0, 119, 0, 28, 0, 121, 7, 3, 0, 1, 7, 1, 0, 119, 0, 25, 0, 121, 6, 4, 0, 1, 7, 0, 0, 1, 6, 1, 0, 119, 0, 21, 0, 41, 71, 8, 24, 42, 71, 71, 24, 32, 71, 71, 40, 121, 71, 5, 0, 1, 7, 0, 0, 1, 6, 0, 0, 25, 5, 5, 1, 119, 0, 13, 0, 41, 71, 8, 24, 42, 71, 71, 24, 33, 71, 71, 41, 121, 71, 4, 0, 1, 7, 0, 0, 1, 6, 0, 0, 119, 0, 6, 0, 120, 5, 2, 0, 119, 0, 10, 0, 1, 7, 0, 0, 1, 6, 0, 0, 26, 5, 5, 1, 25, 9, 9, 1, 78, 8, 9, 0, 41, 71, 8, 24, 42, 71, 71, 24, 120, 71, 205, 255, 119, 0, 131, 0, 135, 9, 29, 0, 0, 0, 0, 0, 25, 7, 2, 60, 82, 5, 42, 0, 25, 3, 5, 4, 1, 71, 84, 0, 135, 6, 0, 0, 71, 0, 0, 0, 85, 47, 6, 0, 25, 4, 5, 8, 82, 8, 4, 0, 106, 71, 5, 12, 45, 71, 8, 71, 144, 50, 0, 0, 135, 71, 1, 0, 3, 47, 0, 0, 119, 0, 5, 0, 85, 8, 6, 0, 82, 71, 4, 0, 25, 71, 71, 4, 85, 4, 71, 0, 25, 8, 9, 4, 116, 36, 8, 0, 106, 70, 8, 4, 109, 36, 4, 70, 106, 71, 8, 8, 109, 36, 8, 71, 1, 71, 0, 0, 132, 0, 0, 71, 25, 70, 9, 16, 135, 71, 2, 0, 62, 51, 70, 0, 130, 71, 0, 0, 0, 8, 71, 0, 1, 71, 0, 0, 132, 0, 0, 71, 38, 71, 8, 1, 121, 71, 4, 0, 0, 2, 6, 0, 1, 60, 145, 0, 119, 0, 202, 1, 25, 8, 9, 28, 116, 13, 8, 0, 106, 70, 8, 4, 109, 13, 4, 70, 106, 71, 8, 8, 109, 13, 8, 71, 106, 70, 8, 12, 109, 13, 12, 70, 106, 71, 8, 16, 109, 13, 16, 71, 106, 70, 8, 20, 109, 13, 20, 70, 1, 70, 0, 0, 132, 0, 0, 70, 1, 71, 0, 0, 135, 70, 12, 0, 63, 57, 65, 71, 130, 70, 0, 0, 0, 8, 70, 0, 1, 70, 0, 0, 132, 0, 0, 70, 38, 70, 8, 1, 121, 70, 4, 0, 0, 2, 6, 0, 1, 60, 146, 0, 119, 0, 176, 1, 1, 70, 0, 0, 132, 0, 0, 70, 1, 71, 10, 0, 1, 68, 0, 0, 1, 69, 0, 0, 135, 70, 27, 0, 71, 6, 36, 9, 57, 68, 69, 0, 130, 70, 0, 0, 0, 9, 70, 0, 1, 70, 0, 0, 132, 0, 0, 70, 38, 70, 9, 1, 121, 70, 4, 0, 1, 5, 1, 0, 1, 60, 147, 0, 119, 0, 159, 1, 85, 47, 6, 0, 1, 69, 0, 0, 109, 2, 76, 69, 25, 9, 2, 68, 82, 8, 9, 0, 106, 69, 2, 72, 45, 69, 8, 69, 244, 51, 0, 0, 1, 69, 0, 0, 132, 0, 0, 69, 25, 70, 2, 64, 135, 69, 2, 0, 64, 70, 47, 0, 130, 69, 0, 0, 0, 9, 69, 0, 1, 69, 0, 0, 132, 0, 0, 69, 38, 69, 9, 1, 121, 69, 8, 0, 1, 5, 0, 0, 1, 60, 147, 0, 119, 0, 137, 1, 85, 8, 6, 0, 82, 69, 9, 0, 25, 69, 69, 4, 85, 9, 69, 0, 1, 69, 0, 0, 132, 0, 0, 69, 82, 70, 7, 0, 82, 70, 70, 0, 135, 69, 2, 0, 70, 7, 6, 0, 130, 69, 0, 0, 0, 9, 69, 0, 1, 69, 0, 0, 132, 0, 0, 69, 38, 69, 9, 1, 121, 69, 4, 0, 1, 5, 0, 0, 1, 60, 147, 0, 119, 0, 118, 1, 135, 69, 5, 0, 57, 0, 0, 0, 135, 69, 5, 0, 51, 0, 0, 0, 119, 0, 164, 0, 1, 70, 160, 125, 1, 68, 13, 0, 135, 69, 24, 0, 37, 70, 68, 0, 1, 69, 0, 0, 132, 0, 0, 69, 116, 47, 29, 0, 106, 68, 29, 4, 109, 47, 4, 68, 106, 69, 29, 8, 109, 47, 8, 69, 1, 68, 192, 0, 135, 69, 12, 0, 68, 0, 37, 47, 130, 69, 0, 0, 0, 9, 69, 0, 1, 69, 0, 0, 132, 0, 0, 69, 38, 69, 9, 1, 121, 69, 3, 0, 1, 60, 156, 0, 119, 0, 91, 1, 135, 69, 5, 0, 37, 0, 0, 0, 119, 0, 139, 0, 1, 68, 1, 0, 135, 69, 22, 0, 0, 68, 0, 0, 116, 47, 14, 0, 106, 68, 14, 4, 109, 47, 4, 68, 106, 69, 14, 8, 109, 47, 8, 69, 1, 69, 0, 0, 135, 9, 26, 0, 0, 47, 69, 0, 25, 7, 2, 60, 82, 5, 42, 0, 25, 3, 5, 4, 1, 69, 84, 0, 135, 6, 0, 0, 69, 0, 0, 0, 85, 47, 6, 0, 25, 4, 5, 8, 82, 8, 4, 0, 106, 69, 5, 12, 45, 69, 8, 69, 32, 53, 0, 0, 135, 69, 1, 0, 3, 47, 0, 0, 119, 0, 5, 0, 85, 8, 6, 0, 82, 69, 4, 0, 25, 69, 69, 4, 85, 4, 69, 0, 25, 8, 9, 4, 116, 46, 8, 0, 106, 68, 8, 4, 109, 46, 4, 68, 106, 69, 8, 8, 109, 46, 8, 69, 1, 69, 0, 0, 132, 0, 0, 69, 25, 68, 9, 16, 135, 69, 2, 0, 62, 53, 68, 0, 130, 69, 0, 0, 0, 8, 69, 0, 1, 69, 0, 0, 132, 0, 0, 69, 38, 69, 8, 1, 121, 69, 4, 0, 0, 2, 6, 0, 1, 60, 92, 0, 119, 0, 38, 1, 25, 8, 9, 28, 116, 19, 8, 0, 106, 68, 8, 4, 109, 19, 4, 68, 106, 69, 8, 8, 109, 19, 8, 69, 106, 68, 8, 12, 109, 19, 12, 68, 106, 69, 8, 16, 109, 19, 16, 69, 106, 68, 8, 20, 109, 19, 20, 68, 1, 68, 0, 0, 132, 0, 0, 68, 1, 69, 0, 0, 135, 68, 12, 0, 63, 55, 65, 69, 130, 68, 0, 0, 0, 8, 68, 0, 1, 68, 0, 0, 132, 0, 0, 68, 38, 68, 8, 1, 121, 68, 4, 0, 0, 2, 6, 0, 1, 60, 93, 0, 119, 0, 12, 1, 1, 68, 0, 0, 132, 0, 0, 68, 1, 69, 10, 0, 1, 70, 0, 0, 1, 71, 0, 0, 135, 68, 27, 0, 69, 6, 46, 9, 55, 70, 71, 0, 130, 68, 0, 0, 0, 9, 68, 0, 1, 68, 0, 0, 132, 0, 0, 68, 38, 68, 9, 1, 121, 68, 4, 0, 1, 5, 1, 0, 1, 60, 94, 0, 119, 0, 251, 0, 85, 34, 6, 0, 1, 71, 0, 0, 109, 2, 76, 71, 25, 9, 2, 68, 82, 8, 9, 0, 106, 71, 2, 72, 45, 71, 8, 71, 132, 54, 0, 0, 1, 71, 0, 0, 132, 0, 0, 71, 25, 68, 2, 64, 135, 71, 2, 0, 64, 68, 34, 0, 130, 71, 0, 0, 0, 9, 71, 0, 1, 71, 0, 0, 132, 0, 0, 71, 38, 71, 9, 1, 121, 71, 8, 0, 1, 5, 0, 0, 1, 60, 94, 0, 119, 0, 229, 0, 85, 8, 6, 0, 82, 71, 9, 0, 25, 71, 71, 4, 85, 9, 71, 0, 1, 71, 0, 0, 132, 0, 0, 71, 82, 68, 7, 0, 82, 68, 68, 0, 135, 71, 2, 0, 68, 7, 6, 0, 130, 71, 0, 0, 0, 9, 71, 0, 1, 71, 0, 0, 132, 0, 0, 71, 38, 71, 9, 1, 121, 71, 4, 0, 1, 5, 0, 0, 1, 60, 94, 0, 119, 0, 210, 0, 135, 71, 5, 0, 55, 0, 0, 0, 135, 71, 5, 0, 53, 0, 0, 0, 1, 68, 1, 0, 135, 71, 30, 0, 0, 68, 0, 0, 120, 71, 25, 0, 1, 68, 176, 125, 1, 70, 18, 0, 135, 71, 24, 0, 38, 68, 70, 0, 1, 71, 0, 0, 132, 0, 0, 71, 116, 47, 29, 0, 106, 70, 29, 4, 109, 47, 4, 70, 106, 71, 29, 8, 109, 47, 8, 71, 1, 70, 192, 0, 135, 71, 12, 0, 70, 0, 38, 47, 130, 71, 0, 0, 0, 9, 71, 0, 1, 71, 0, 0, 132, 0, 0, 71, 38, 71, 9, 1, 121, 71, 3, 0, 1, 60, 160, 0, 119, 0, 180, 0, 135, 71, 5, 0, 38, 0, 0, 0, 85, 39, 1, 0, 82, 9, 16, 0, 82, 71, 17, 0, 48, 71, 9, 71, 120, 55, 0, 0, 85, 9, 1, 0, 82, 71, 16, 0, 25, 71, 71, 4, 85, 16, 71, 0, 119, 0, 152, 0, 135, 71, 31, 0, 18, 39, 0, 0, 119, 0, 149, 0, 82, 8, 20, 0, 82, 5, 21, 0, 4, 6, 5, 8, 1, 71, 239, 255, 48, 71, 71, 6, 172, 55, 0, 0, 135, 71, 32, 0, 54, 0, 0, 0, 1, 60, 22, 0, 119, 0, 8, 0, 35, 71, 6, 11, 121, 71, 5, 0, 41, 71, 6, 1, 83, 54, 71, 0, 0, 9, 27, 0, 119, 0, 2, 0, 1, 60, 22, 0, 32, 71, 60, 22, 121, 71, 11, 0, 1, 60, 0, 0, 25, 71, 6, 16, 38, 71, 71, 240, 0, 7, 71, 0, 135, 9, 0, 0, 7, 0, 0, 0, 85, 22, 9, 0, 39, 71, 7, 1, 85, 54, 71, 0, 85, 23, 6, 0, 46, 71, 8, 5, 36, 56, 0, 0, 0, 7, 9, 0, 78, 71, 8, 0, 83, 7, 71, 0, 25, 8, 8, 1, 52, 71, 8, 5, 32, 56, 0, 0, 25, 7, 7, 1, 119, 0, 250, 255, 3, 9, 9, 6, 1, 71, 0, 0, 83, 9, 71, 0, 1, 71, 0, 0, 132, 0, 0, 71, 1, 70, 169, 1, 82, 68, 42, 0, 1, 69, 244, 0, 3, 68, 68, 69, 135, 71, 2, 0, 70, 49, 68, 0, 130, 71, 0, 0, 0, 9, 71, 0, 1, 71, 0, 0, 132, 0, 0, 71, 38, 71, 9, 1, 121, 71, 3, 0, 1, 60, 43, 0, 119, 0, 107, 0, 1, 71, 0, 0, 132, 0, 0, 71, 1, 71, 27, 0, 1, 68, 1, 0, 135, 9, 9, 0, 71, 0, 54, 59, 49, 68, 0, 0, 130, 68, 0, 0, 0, 8, 68, 0, 1, 68, 0, 0, 132, 0, 0, 68, 38, 68, 8, 1, 121, 68, 3, 0, 1, 60, 44, 0, 119, 0, 92, 0, 82, 8, 49, 0, 0, 7, 8, 0, 121, 8, 13, 0, 82, 6, 32, 0, 46, 68, 6, 8, 220, 56, 0, 0, 26, 68, 6, 4, 4, 68, 68, 7, 43, 68, 68, 2, 11, 68, 68, 0, 41, 68, 68, 2, 3, 68, 6, 68, 85, 32, 68, 0, 135, 68, 10, 0, 8, 0, 0, 0, 135, 68, 5, 0, 54, 0, 0, 0, 120, 9, 58, 0, 82, 8, 20, 0, 82, 6, 21, 0, 4, 5, 6, 8, 1, 68, 239, 255, 48, 68, 68, 5, 24, 57, 0, 0, 135, 68, 32, 0, 43, 0, 0, 0, 1, 60, 37, 0, 119, 0, 8, 0, 35, 68, 5, 11, 121, 68, 5, 0, 41, 68, 5, 1, 83, 43, 68, 0, 0, 9, 26, 0, 119, 0, 2, 0, 1, 60, 37, 0, 32, 68, 60, 37, 121, 68, 11, 0, 1, 60, 0, 0, 25, 68, 5, 16, 38, 68, 68, 240, 0, 7, 68, 0, 135, 9, 0, 0, 7, 0, 0, 0, 85, 24, 9, 0, 39, 68, 7, 1, 85, 43, 68, 0, 85, 25, 5, 0, 46, 68, 8, 6, 144, 57, 0, 0, 0, 7, 9, 0, 78, 68, 8, 0, 83, 7, 68, 0, 25, 8, 8, 1, 52, 68, 8, 6, 140, 57, 0, 0, 25, 7, 7, 1, 119, 0, 250, 255, 3, 9, 9, 5, 1, 68, 0, 0, 83, 9, 68, 0, 1, 68, 0, 0, 132, 0, 0, 68, 1, 71, 195, 0, 135, 68, 12, 0, 71, 0, 59, 43, 130, 68, 0, 0, 0, 9, 68, 0, 1, 68, 0, 0, 132, 0, 0, 68, 38, 68, 9, 1, 121, 68, 3, 0, 1, 60, 49, 0, 119, 0, 19, 0, 135, 68, 5, 0, 43, 0, 0, 0, 116, 47, 14, 0, 106, 71, 14, 4, 109, 47, 4, 71, 106, 68, 14, 8, 109, 47, 8, 68, 1, 71, 1, 0, 135, 68, 33, 0, 0, 71, 0, 0, 1, 71, 1, 0, 135, 68, 34, 0, 0, 71, 0, 0, 120, 68, 3, 0, 1, 60, 173, 0, 119, 0, 3, 0, 1, 9, 0, 0, 119, 0, 110, 252, 1, 68, 43, 0, 1, 71, 131, 0, 138, 60, 68, 71, 48, 60, 0, 0, 60, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 140, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 164, 60, 0, 0, 192, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 228, 60, 0, 0, 252, 60, 0, 0, 16, 61, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 61, 0, 0, 72, 61, 0, 0, 108, 61, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 176, 61, 0, 0, 204, 61, 0, 0, 240, 61, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 52, 62, 0, 0, 80, 62, 0, 0, 116, 62, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 184, 62, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 208, 62, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 232, 62, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 0, 63, 0, 0, 44, 60, 0, 0, 44, 60, 0, 0, 24, 63, 0, 0, 119, 0, 195, 0, 135, 1, 3, 0, 1, 60, 48, 0, 119, 0, 192, 0, 135, 1, 3, 0, 82, 2, 49, 0, 0, 3, 2, 0, 120, 2, 3, 0, 1, 60, 48, 0, 119, 0, 186, 0, 82, 4, 32, 0, 46, 68, 4, 2, 124, 60, 0, 0, 26, 68, 4, 4, 4, 68, 68, 3, 43, 68, 68, 2, 11, 68, 68, 0, 41, 68, 68, 2, 3, 68, 4, 68, 85, 32, 68, 0, 135, 68, 10, 0, 2, 0, 0, 0, 1, 60, 48, 0, 119, 0, 172, 0, 135, 60, 3, 0, 135, 68, 5, 0, 43, 0, 0, 0, 135, 68, 14, 0, 60, 0, 0, 0, 119, 0, 1, 0, 135, 7, 3, 0, 128, 68, 0, 0, 0, 1, 68, 0, 0, 6, 4, 0, 0, 5, 2, 0, 1, 60, 76, 0, 119, 0, 159, 0, 135, 7, 3, 0, 128, 68, 0, 0, 0, 1, 68, 0, 135, 68, 5, 0, 28, 0, 0, 0, 0, 6, 4, 0, 0, 5, 2, 0, 1, 60, 76, 0, 119, 0, 150, 0, 135, 7, 3, 0, 128, 68, 0, 0, 0, 1, 68, 0, 0, 6, 4, 0, 0, 5, 2, 0, 119, 0, 144, 0, 135, 5, 3, 0, 128, 68, 0, 0, 0, 1, 68, 0, 1, 60, 85, 0, 119, 0, 139, 0, 135, 5, 3, 0, 128, 68, 0, 0, 0, 1, 68, 0, 135, 68, 5, 0, 50, 0, 0, 0, 1, 60, 85, 0, 119, 0, 132, 0, 135, 8, 3, 0, 128, 68, 0, 0, 0, 1, 68, 0, 0, 7, 4, 0, 0, 5, 2, 0, 1, 60, 95, 0, 119, 0, 125, 0, 135, 8, 3, 0, 128, 68, 0, 0, 0, 1, 68, 0, 135, 68, 5, 0, 53, 0, 0, 0, 0, 7, 4, 0, 0, 5, 2, 0, 1, 60, 95, 0, 119, 0, 116, 0, 135, 2, 3, 0, 128, 68, 0, 0, 0, 1, 68, 0, 135, 68, 5, 0, 55, 0, 0, 0, 135, 68, 5, 0, 53, 0, 0, 0, 121, 5, 6, 0, 0, 8, 2, 0, 0, 7, 4, 0, 0, 5, 6, 0, 1, 60, 95, 0, 119, 0, 103, 0, 0, 60, 2, 0, 135, 68, 14, 0, 60, 0, 0, 0, 119, 0, 99, 0, 135, 8, 3, 0, 128, 68, 0, 0, 0, 1, 68, 0, 0, 7, 4, 0, 0, 5, 2, 0, 1, 60, 116, 0, 119, 0, 92, 0, 135, 8, 3, 0, 128, 68, 0, 0, 0, 1, 68, 0, 135, 68, 5, 0, 52, 0, 0, 0, 0, 7, 4, 0, 0, 5, 2, 0, 1, 60, 116, 0, 119, 0, 83, 0, 135, 2, 3, 0, 128, 68, 0, 0, 0, 1, 68, 0, 135, 68, 5, 0, 56, 0, 0, 0, 135, 68, 5, 0, 52, 0, 0, 0, 121, 5, 6, 0, 0, 8, 2, 0, 0, 7, 4, 0, 0, 5, 6, 0, 1, 60, 116, 0, 119, 0, 70, 0, 0, 60, 2, 0, 135, 68, 14, 0, 60, 0, 0, 0, 119, 0, 66, 0, 135, 8, 3, 0, 128, 68, 0, 0, 0, 1, 68, 0, 0, 7, 4, 0, 0, 5, 2, 0, 1, 60, 148, 0, 119, 0, 59, 0, 135, 8, 3, 0, 128, 68, 0, 0, 0, 1, 68, 0, 135, 68, 5, 0, 51, 0, 0, 0, 0, 7, 4, 0, 0, 5, 2, 0, 1, 60, 148, 0, 119, 0, 50, 0, 135, 2, 3, 0, 128, 68, 0, 0, 0, 1, 68, 0, 135, 68, 5, 0, 57, 0, 0, 0, 135, 68, 5, 0, 51, 0, 0, 0, 121, 5, 6, 0, 0, 8, 2, 0, 0, 7, 4, 0, 0, 5, 6, 0, 1, 60, 148, 0, 119, 0, 37, 0, 0, 60, 2, 0, 135, 68, 14, 0, 60, 0, 0, 0, 119, 0, 33, 0, 135, 60, 3, 0, 135, 68, 5, 0, 37, 0, 0, 0, 135, 68, 14, 0, 60, 0, 0, 0, 119, 0, 1, 0, 135, 60, 3, 0, 135, 68, 5, 0, 38, 0, 0, 0, 135, 68, 14, 0, 60, 0, 0, 0, 119, 0, 1, 0, 135, 60, 3, 0, 135, 68, 5, 0, 40, 0, 0, 0, 135, 68, 14, 0, 60, 0, 0, 0, 119, 0, 1, 0, 135, 60, 3, 0, 135, 68, 5, 0, 41, 0, 0, 0, 135, 68, 14, 0, 60, 0, 0, 0, 119, 0, 1, 0, 116, 14, 47, 0, 106, 71, 47, 4, 109, 14, 4, 71, 106, 68, 47, 8, 109, 14, 8, 68, 137, 48, 0, 0, 139, 59, 0, 0, 119, 0, 1, 0, 32, 68, 60, 48, 121, 68, 7, 0, 135, 68, 5, 0, 54, 0, 0, 0, 0, 60, 1, 0, 135, 68, 14, 0, 60, 0, 0, 0, 119, 0, 189, 0, 32, 68, 60, 76, 121, 68, 44, 0, 82, 3, 3, 0, 82, 2, 6, 0, 45, 68, 3, 2, 120, 63, 0, 0, 0, 4, 3, 0, 119, 0, 11, 0, 0, 4, 3, 0, 82, 68, 4, 0, 52, 68, 68, 5, 160, 63, 0, 0, 25, 4, 4, 4, 45, 68, 4, 2, 156, 63, 0, 0, 0, 4, 2, 0, 119, 0, 2, 0, 119, 0, 248, 255, 4, 68, 4, 3, 42, 68, 68, 2, 25, 68, 68, 1, 41, 68, 68, 2, 3, 60, 3, 68, 4, 1, 2, 60, 135, 68, 13, 0, 4, 60, 1, 0, 42, 68, 1, 2, 41, 68, 68, 2, 3, 1, 4, 68, 82, 2, 6, 0, 46, 68, 2, 1, 244, 63, 0, 0, 26, 68, 2, 4, 4, 68, 68, 1, 43, 68, 68, 2, 11, 68, 68, 0, 41, 68, 68, 2, 3, 68, 2, 68, 85, 6, 68, 0, 135, 68, 10, 0, 5, 0, 0, 0, 0, 60, 7, 0, 135, 68, 14, 0, 60, 0, 0, 0, 119, 0, 144, 0, 32, 68, 60, 85, 121, 68, 7, 0, 135, 68, 5, 0, 58, 0, 0, 0, 0, 7, 5, 0, 0, 6, 4, 0, 0, 5, 2, 0, 119, 0, 136, 0, 32, 68, 60, 95, 121, 68, 44, 0, 82, 3, 3, 0, 82, 2, 7, 0, 45, 68, 3, 2, 76, 64, 0, 0, 0, 4, 3, 0, 119, 0, 11, 0, 0, 4, 3, 0, 82, 68, 4, 0, 52, 68, 68, 5, 116, 64, 0, 0, 25, 4, 4, 4, 45, 68, 4, 2, 112, 64, 0, 0, 0, 4, 2, 0, 119, 0, 2, 0, 119, 0, 248, 255, 4, 68, 4, 3, 42, 68, 68, 2, 25, 68, 68, 1, 41, 68, 68, 2, 3, 1, 3, 68, 4, 2, 2, 1, 135, 68, 13, 0, 4, 1, 2, 0, 42, 68, 2, 2, 41, 68, 68, 2, 3, 2, 4, 68, 82, 1, 7, 0, 46, 68, 1, 2, 200, 64, 0, 0, 26, 68, 1, 4, 4, 68, 68, 2, 43, 68, 68, 2, 11, 68, 68, 0, 41, 68, 68, 2, 3, 68, 1, 68, 85, 7, 68, 0, 135, 68, 10, 0, 5, 0, 0, 0, 0, 60, 8, 0, 135, 68, 14, 0, 60, 0, 0, 0, 119, 0, 91, 0, 32, 68, 60, 116, 121, 68, 44, 0, 82, 3, 3, 0, 82, 2, 7, 0, 45, 68, 3, 2, 0, 65, 0, 0, 0, 4, 3, 0, 119, 0, 11, 0, 0, 4, 3, 0, 82, 68, 4, 0, 52, 68, 68, 5, 40, 65, 0, 0, 25, 4, 4, 4, 45, 68, 4, 2, 36, 65, 0, 0, 0, 4, 2, 0, 119, 0, 2, 0, 119, 0, 248, 255, 4, 68, 4, 3, 42, 68, 68, 2, 25, 68, 68, 1, 41, 68, 68, 2, 3, 1, 3, 68, 4, 2, 2, 1, 135, 68, 13, 0, 4, 1, 2, 0, 42, 68, 2, 2, 41, 68, 68, 2, 3, 2, 4, 68, 82, 1, 7, 0, 46, 68, 1, 2, 124, 65, 0, 0, 26, 68, 1, 4, 4, 68, 68, 2, 43, 68, 68, 2, 11, 68, 68, 0, 41, 68, 68, 2, 3, 68, 1, 68, 85, 7, 68, 0, 135, 68, 10, 0, 5, 0, 0, 0, 0, 60, 8, 0, 135, 68, 14, 0, 60, 0, 0, 0, 119, 0, 46, 0, 1, 68, 148, 0, 45, 68, 60, 68, 72, 66, 0, 0, 82, 3, 3, 0, 82, 2, 7, 0, 45, 68, 3, 2, 184, 65, 0, 0, 0, 4, 3, 0, 119, 0, 11, 0, 0, 4, 3, 0, 82, 68, 4, 0, 52, 68, 68, 5, 224, 65, 0, 0, 25, 4, 4, 4, 45, 68, 4, 2, 220, 65, 0, 0, 0, 4, 2, 0, 119, 0, 2, 0, 119, 0, 248, 255, 4, 68, 4, 3, 42, 68, 68, 2, 25, 68, 68, 1, 41, 68, 68, 2, 3, 1, 3, 68, 4, 2, 2, 1, 135, 68, 13, 0, 4, 1, 2, 0, 42, 68, 2, 2, 41, 68, 68, 2, 3, 2, 4, 68, 82, 1, 7, 0, 46, 68, 1, 2, 52, 66, 0, 0, 26, 68, 1, 4, 4, 68, 68, 2, 43, 68, 68, 2, 11, 68, 68, 0, 41, 68, 68, 2, 3, 68, 1, 68, 85, 7, 68, 0, 135, 68, 10, 0, 5, 0, 0, 0, 0, 60, 8, 0, 135, 68, 14, 0, 60, 0, 0, 0, 82, 3, 3, 0, 82, 2, 6, 0, 45, 68, 3, 2, 96, 66, 0, 0, 0, 4, 3, 0, 119, 0, 11, 0, 0, 4, 3, 0, 82, 68, 4, 0, 52, 68, 68, 5, 136, 66, 0, 0, 25, 4, 4, 4, 45, 68, 4, 2, 132, 66, 0, 0, 0, 4, 2, 0, 119, 0, 2, 0, 119, 0, 248, 255, 4, 68, 4, 3, 42, 68, 68, 2, 25, 68, 68, 1, 41, 68, 68, 2, 3, 1, 3, 68, 4, 2, 2, 1, 135, 68, 13, 0, 4, 1, 2, 0, 42, 68, 2, 2, 41, 68, 68, 2, 3, 2, 4, 68, 82, 1, 6, 0, 46, 68, 1, 2, 220, 66, 0, 0, 26, 68, 1, 4, 4, 68, 68, 2, 43, 68, 68, 2, 11, 68, 68, 0, 41, 68, 68, 2, 3, 68, 1, 68, 85, 6, 68, 0, 135, 68, 10, 0, 5, 0, 0, 0, 0, 60, 7, 0, 135, 68, 14, 0, 60, 0, 0, 0, 82, 2, 6, 0, 82, 1, 9, 0, 45, 68, 2, 1, 8, 67, 0, 0, 0, 4, 2, 0, 119, 0, 11, 0, 0, 4, 2, 0, 82, 68, 4, 0, 52, 68, 68, 59, 48, 67, 0, 0, 25, 4, 4, 4, 45, 68, 4, 1, 44, 67, 0, 0, 0, 4, 1, 0, 119, 0, 2, 0, 119, 0, 248, 255, 4, 68, 4, 2, 42, 68, 68, 2, 25, 68, 68, 1, 41, 68, 68, 2, 3, 60, 2, 68, 4, 2, 1, 60, 135, 68, 13, 0, 4, 60, 2, 0, 42, 68, 2, 2, 41, 68, 68, 2, 3, 2, 4, 68, 82, 1, 9, 0, 46, 68, 1, 2, 132, 67, 0, 0, 26, 68, 1, 4, 4, 68, 68, 2, 43, 68, 68, 2, 11, 68, 68, 0, 41, 68, 68, 2, 3, 68, 1, 68, 85, 9, 68, 0, 135, 68, 10, 0, 59, 0, 0, 0, 0, 60, 5, 0, 135, 68, 14, 0, 60, 0, 0, 0, 1, 68, 0, 0, 139, 68, 0, 0, 140, 1, 45, 0, 0, 0, 0, 0, 2, 37, 0, 0, 255, 1, 0, 0, 2, 38, 0, 0, 188, 1, 0, 0, 2, 39, 0, 0, 149, 0, 0, 0, 2, 40, 0, 0, 232, 50, 0, 0, 136, 41, 0, 0, 0, 32, 41, 0, 136, 41, 0, 0, 1, 42, 144, 2, 3, 41, 41, 42, 137, 41, 0, 0, 1, 41, 116, 2, 3, 13, 32, 41, 1, 41, 120, 1, 3, 14, 32, 41, 1, 41, 136, 0, 3, 5, 32, 41, 25, 16, 32, 124, 25, 36, 32, 8, 1, 41, 56, 1, 3, 25, 32, 41, 1, 41, 48, 2, 3, 21, 32, 41, 1, 41, 104, 2, 3, 27, 32, 41, 1, 41, 120, 2, 3, 24, 32, 41, 1, 41, 184, 0, 3, 35, 32, 41, 0, 26, 32, 0, 1, 41, 248, 0, 3, 34, 32, 41, 1, 41, 216, 0, 3, 33, 32, 41, 25, 31, 32, 36, 1, 41, 16, 1, 3, 30, 32, 41, 25, 28, 32, 112, 1, 41, 96, 2, 3, 29, 32, 41, 25, 11, 0, 92, 25, 12, 0, 88, 82, 8, 12, 0, 82, 41, 11, 0, 45, 41, 41, 8, 120, 68, 0, 0, 1, 36, 0, 0, 137, 32, 0, 0, 139, 36, 0, 0, 1, 41, 100, 1, 3, 3, 0, 41, 1, 41, 104, 1, 3, 2, 0, 41, 1, 41, 96, 1, 3, 1, 0, 41, 25, 15, 5, 12, 25, 10, 0, 100, 1, 41, 128, 0, 3, 17, 14, 41, 25, 18, 14, 64, 25, 19, 14, 52, 25, 22, 14, 12, 25, 23, 14, 56, 25, 20, 14, 68, 1, 6, 0, 0, 1, 4, 0, 0, 27, 41, 6, 28, 3, 41, 8, 41, 25, 9, 41, 12, 78, 41, 9, 0, 38, 41, 41, 1, 120, 41, 3, 0, 25, 7, 9, 1, 119, 0, 4, 0, 27, 41, 6, 28, 3, 41, 8, 41, 106, 7, 41, 20, 27, 41, 6, 28, 3, 9, 8, 41, 78, 41, 9, 0, 38, 41, 41, 1, 120, 41, 3, 0, 25, 9, 9, 1, 119, 0, 4, 0, 27, 41, 6, 28, 3, 41, 8, 41, 106, 9, 41, 8, 1, 41, 0, 0, 1, 42, 0, 0, 135, 9, 35, 0, 7, 9, 41, 42, 85, 13, 9, 0, 82, 8, 3, 0, 82, 42, 2, 0, 45, 42, 8, 42, 64, 69, 0, 0, 135, 42, 36, 0, 1, 13, 0, 0, 119, 0, 5, 0, 85, 8, 9, 0, 82, 42, 3, 0, 25, 42, 42, 4, 85, 3, 42, 0, 82, 8, 12, 0, 27, 42, 6, 28, 3, 8, 8, 42, 106, 9, 8, 24, 135, 42, 8, 0, 16, 8, 0, 0, 1, 42, 0, 0, 132, 0, 0, 42, 1, 41, 10, 0, 82, 43, 12, 0, 27, 44, 6, 28, 3, 43, 43, 44, 106, 43, 43, 24, 135, 42, 4, 0, 41, 5, 16, 43, 6, 0, 0, 0, 130, 42, 0, 0, 0, 8, 42, 0, 1, 42, 0, 0, 132, 0, 0, 42, 38, 42, 8, 1, 121, 42, 3, 0, 1, 14, 17, 0, 119, 0, 116, 0, 1, 42, 0, 0, 132, 0, 0, 42, 1, 43, 14, 0, 135, 42, 4, 0, 43, 14, 9, 0, 5, 0, 0, 0, 130, 42, 0, 0, 0, 9, 42, 0, 1, 42, 0, 0, 132, 0, 0, 42, 38, 42, 9, 1, 121, 42, 3, 0, 1, 14, 18, 0, 119, 0, 102, 0, 135, 42, 5, 0, 15, 0, 0, 0, 135, 42, 5, 0, 16, 0, 0, 0, 1, 42, 0, 0, 132, 0, 0, 42, 1, 42, 136, 0, 135, 8, 11, 0, 42, 14, 0, 0, 130, 42, 0, 0, 0, 9, 42, 0, 1, 42, 0, 0, 132, 0, 0, 42, 38, 42, 9, 1, 121, 42, 3, 0, 1, 14, 20, 0, 119, 0, 85, 0, 1, 42, 0, 0, 132, 0, 0, 42, 1, 43, 52, 1, 82, 41, 3, 0, 26, 41, 41, 4, 82, 41, 41, 0, 135, 42, 37, 0, 43, 41, 0, 0, 130, 42, 0, 0, 0, 9, 42, 0, 1, 42, 0, 0, 132, 0, 0, 42, 38, 42, 9, 1, 121, 42, 3, 0, 1, 14, 20, 0, 119, 0, 69, 0, 82, 42, 3, 0, 26, 42, 42, 4, 85, 3, 42, 0, 32, 42, 6, 0, 125, 4, 42, 8, 4, 0, 0, 0, 1, 42, 0, 0, 132, 0, 0, 42, 1, 42, 241, 2, 82, 41, 12, 0, 27, 43, 6, 28, 3, 41, 41, 43, 25, 41, 41, 12, 135, 9, 15, 0, 42, 10, 41, 0, 130, 41, 0, 0, 0, 7, 41, 0, 1, 41, 0, 0, 132, 0, 0, 41, 38, 41, 7, 1, 121, 41, 3, 0, 1, 14, 20, 0, 119, 0, 46, 0, 85, 9, 8, 0, 135, 41, 5, 0, 17, 0, 0, 0, 82, 9, 18, 0, 0, 8, 9, 0, 121, 9, 13, 0, 82, 7, 20, 0, 46, 41, 7, 9, 8, 71, 0, 0, 26, 41, 7, 4, 4, 41, 41, 8, 43, 41, 41, 2, 11, 41, 41, 0, 41, 41, 41, 2, 3, 41, 7, 41, 85, 20, 41, 0, 135, 41, 10, 0, 9, 0, 0, 0, 82, 9, 19, 0, 0, 8, 9, 0, 121, 9, 13, 0, 82, 7, 23, 0, 46, 41, 7, 9, 68, 71, 0, 0, 26, 41, 7, 4, 4, 41, 41, 8, 43, 41, 41, 2, 11, 41, 41, 0, 41, 41, 41, 2, 3, 41, 7, 41, 85, 23, 41, 0, 135, 41, 10, 0, 9, 0, 0, 0, 135, 41, 5, 0, 22, 0, 0, 0, 25, 6, 6, 1, 82, 8, 12, 0, 82, 41, 11, 0, 4, 41, 41, 8, 28, 41, 41, 28, 50, 41, 41, 6, 120, 71, 0, 0, 1, 14, 38, 0, 119, 0, 2, 0, 119, 0, 81, 255, 32, 41, 14, 17, 121, 41, 3, 0, 135, 1, 3, 0, 119, 0, 125, 2, 32, 41, 14, 18, 121, 41, 5, 0, 135, 1, 3, 0, 135, 41, 5, 0, 15, 0, 0, 0, 119, 0, 119, 2, 32, 41, 14, 20, 121, 41, 40, 0, 135, 7, 3, 0, 135, 41, 5, 0, 17, 0, 0, 0, 82, 4, 18, 0, 0, 3, 4, 0, 121, 4, 13, 0, 82, 2, 20, 0, 46, 41, 2, 4, 236, 71, 0, 0, 26, 41, 2, 4, 4, 41, 41, 3, 43, 41, 41, 2, 11, 41, 41, 0, 41, 41, 41, 2, 3, 41, 2, 41, 85, 20, 41, 0, 135, 41, 10, 0, 4, 0, 0, 0, 82, 3, 19, 0, 0, 2, 3, 0, 121, 3, 13, 0, 82, 1, 23, 0, 46, 41, 1, 3, 40, 72, 0, 0, 26, 41, 1, 4, 4, 41, 41, 2, 43, 41, 41, 2, 11, 41, 41, 0, 41, 41, 41, 2, 3, 41, 1, 41, 85, 23, 41, 0, 135, 41, 10, 0, 3, 0, 0, 0, 135, 41, 5, 0, 22, 0, 0, 0, 0, 36, 7, 0, 135, 41, 14, 0, 36, 0, 0, 0, 119, 0, 78, 2, 32, 41, 14, 38, 121, 41, 76, 2, 120, 4, 4, 0, 1, 36, 0, 0, 137, 32, 0, 0, 139, 36, 0, 0, 1, 42, 0, 0, 109, 36, 4, 42, 1, 41, 0, 0, 109, 36, 8, 41, 25, 22, 36, 4, 85, 36, 22, 0, 25, 23, 36, 12, 1, 41, 0, 0, 85, 23, 41, 0, 1, 42, 0, 0, 109, 23, 4, 42, 1, 41, 0, 0, 109, 23, 8, 41, 1, 42, 0, 0, 109, 23, 12, 42, 1, 42, 0, 0, 132, 0, 0, 42, 1, 41, 136, 0, 2, 43, 0, 0, 8, 208, 0, 0, 1, 44, 0, 0, 135, 42, 12, 0, 41, 27, 43, 44, 130, 42, 0, 0, 0, 23, 42, 0, 1, 42, 0, 0, 132, 0, 0, 42, 38, 42, 23, 1, 121, 42, 5, 0, 135, 2, 3, 0, 128, 42, 0, 0, 0, 1, 42, 0, 119, 0, 254, 1, 1, 42, 0, 0, 132, 0, 0, 42, 1, 44, 10, 0, 1, 43, 0, 0, 1, 41, 255, 255, 135, 42, 4, 0, 44, 21, 27, 43, 41, 0, 0, 0, 130, 42, 0, 0, 0, 23, 42, 0, 1, 42, 0, 0, 132, 0, 0, 42, 38, 42, 23, 1, 121, 42, 5, 0, 135, 2, 3, 0, 128, 42, 0, 0, 0, 1, 42, 0, 119, 0, 234, 1, 1, 42, 0, 0, 132, 0, 0, 42, 1, 41, 136, 0, 2, 43, 0, 0, 8, 208, 0, 0, 1, 44, 0, 0, 135, 42, 12, 0, 41, 24, 43, 44, 130, 42, 0, 0, 0, 23, 42, 0, 1, 42, 0, 0, 132, 0, 0, 42, 38, 42, 23, 1, 121, 42, 6, 0, 135, 2, 3, 0, 128, 42, 0, 0, 0, 1, 42, 0, 25, 3, 21, 12, 119, 0, 213, 1, 1, 42, 0, 0, 85, 25, 42, 0, 25, 23, 25, 4, 116, 23, 21, 0, 106, 44, 21, 4, 109, 23, 4, 44, 106, 42, 21, 8, 109, 23, 8, 42, 25, 23, 25, 16, 25, 3, 21, 12, 1, 42, 0, 0, 132, 0, 0, 42, 1, 44, 144, 1, 135, 42, 2, 0, 44, 23, 3, 0, 130, 42, 0, 0, 0, 20, 42, 0, 1, 42, 0, 0, 132, 0, 0, 42, 38, 42, 20, 1, 121, 42, 5, 0, 135, 2, 3, 0, 128, 42, 0, 0, 0, 1, 42, 0, 119, 0, 186, 1, 25, 20, 25, 28, 25, 21, 21, 24, 116, 20, 21, 0, 106, 44, 21, 4, 109, 20, 4, 44, 106, 42, 21, 8, 109, 20, 8, 42, 106, 44, 21, 12, 109, 20, 12, 44, 106, 42, 21, 16, 109, 20, 16, 42, 106, 44, 21, 20, 109, 20, 20, 44, 25, 21, 25, 52, 1, 44, 0, 0, 132, 0, 0, 44, 1, 42, 144, 1, 135, 44, 2, 0, 42, 21, 24, 0, 130, 44, 0, 0, 0, 20, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 20, 1, 121, 44, 7, 0, 135, 2, 3, 0, 128, 44, 0, 0, 0, 1, 44, 0, 135, 44, 5, 0, 23, 0, 0, 0, 119, 0, 155, 1, 135, 44, 5, 0, 24, 0, 0, 0, 135, 44, 5, 0, 3, 0, 0, 0, 135, 44, 5, 0, 27, 0, 0, 0, 1, 44, 0, 0, 132, 0, 0, 44, 1, 42, 176, 1, 135, 44, 2, 0, 42, 0, 36, 0, 130, 44, 0, 0, 0, 27, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 27, 1, 121, 44, 3, 0, 1, 14, 58, 0, 119, 0, 125, 1, 1, 44, 0, 1, 3, 6, 0, 44, 82, 8, 6, 0, 1, 44, 4, 1, 94, 44, 0, 44, 4, 44, 44, 8, 42, 44, 44, 2, 0, 5, 44, 0, 121, 5, 25, 0, 1, 7, 0, 0, 1, 44, 0, 0, 132, 0, 0, 44, 1, 42, 148, 0, 41, 43, 7, 2, 94, 43, 8, 43, 135, 44, 12, 0, 42, 0, 36, 43, 130, 44, 0, 0, 0, 27, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 27, 1, 120, 44, 6, 0, 25, 7, 7, 1, 57, 44, 5, 7, 40, 75, 0, 0, 82, 8, 6, 0, 119, 0, 239, 255, 135, 2, 3, 0, 128, 44, 0, 0, 0, 1, 44, 0, 1, 14, 59, 0, 119, 0, 92, 1, 1, 44, 0, 0, 132, 0, 0, 44, 1, 43, 11, 0, 1, 42, 0, 0, 1, 41, 0, 0, 135, 44, 27, 0, 43, 35, 0, 36, 25, 42, 41, 0, 130, 44, 0, 0, 0, 27, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 27, 1, 121, 44, 3, 0, 1, 14, 58, 0, 119, 0, 76, 1, 1, 44, 0, 0, 132, 0, 0, 44, 1, 41, 177, 1, 135, 44, 2, 0, 41, 26, 0, 0, 130, 44, 0, 0, 0, 27, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 27, 1, 121, 44, 5, 0, 135, 2, 3, 0, 128, 44, 0, 0, 0, 1, 44, 0, 119, 0, 59, 1, 1, 44, 0, 0, 132, 0, 0, 44, 1, 41, 12, 0, 135, 44, 27, 0, 41, 34, 0, 35, 26, 36, 25, 0, 130, 44, 0, 0, 0, 27, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 27, 1, 121, 44, 5, 0, 135, 2, 3, 0, 128, 44, 0, 0, 0, 1, 44, 0, 119, 0, 43, 1, 1, 44, 0, 0, 132, 0, 0, 44, 1, 41, 6, 0, 135, 44, 38, 0, 41, 33, 0, 34, 36, 25, 0, 0, 130, 44, 0, 0, 0, 27, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 27, 1, 121, 44, 5, 0, 135, 2, 3, 0, 128, 44, 0, 0, 0, 1, 44, 0, 119, 0, 25, 1, 1, 44, 0, 0, 132, 0, 0, 44, 1, 41, 13, 0, 135, 44, 27, 0, 41, 31, 0, 34, 33, 36, 25, 0, 130, 44, 0, 0, 0, 27, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 27, 1, 121, 44, 5, 0, 135, 2, 3, 0, 128, 44, 0, 0, 0, 1, 44, 0, 119, 0, 7, 1, 1, 44, 0, 0, 132, 0, 0, 44, 1, 41, 15, 0, 135, 44, 4, 0, 41, 30, 0, 36, 25, 0, 0, 0, 130, 44, 0, 0, 0, 27, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 27, 1, 121, 44, 5, 0, 135, 2, 3, 0, 128, 44, 0, 0, 0, 1, 44, 0, 119, 0, 245, 0, 1, 44, 0, 0, 132, 0, 0, 44, 82, 44, 4, 0, 106, 44, 44, 16, 135, 7, 15, 0, 44, 4, 31, 0, 130, 44, 0, 0, 0, 27, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 27, 1, 121, 44, 3, 0, 1, 14, 78, 0, 119, 0, 193, 0, 1, 44, 0, 0, 132, 0, 0, 44, 82, 44, 7, 0, 106, 44, 44, 48, 135, 7, 11, 0, 44, 7, 0, 0, 130, 44, 0, 0, 0, 27, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 27, 1, 121, 44, 3, 0, 1, 14, 78, 0, 119, 0, 179, 0, 1, 44, 0, 0, 132, 0, 0, 44, 82, 44, 7, 0, 106, 44, 44, 16, 135, 7, 15, 0, 44, 7, 30, 0, 130, 44, 0, 0, 0, 27, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 27, 1, 121, 44, 3, 0, 1, 14, 78, 0, 119, 0, 165, 0, 1, 44, 0, 0, 132, 0, 0, 44, 82, 44, 7, 0, 106, 44, 44, 48, 135, 9, 11, 0, 44, 7, 0, 0, 130, 44, 0, 0, 0, 27, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 27, 1, 121, 44, 3, 0, 1, 14, 78, 0, 119, 0, 151, 0, 1, 44, 184, 1, 3, 8, 0, 44, 82, 44, 8, 0, 94, 41, 0, 38, 46, 44, 44, 41, 16, 78, 0, 0, 1, 44, 0, 0, 132, 0, 0, 44, 135, 44, 12, 0, 39, 28, 0, 8, 130, 44, 0, 0, 0, 27, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 27, 1, 121, 44, 3, 0, 1, 14, 78, 0, 119, 0, 133, 0, 1, 44, 0, 0, 132, 0, 0, 44, 82, 41, 9, 0, 106, 41, 41, 8, 135, 44, 2, 0, 41, 9, 28, 0, 130, 44, 0, 0, 0, 28, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 28, 1, 120, 44, 2, 0, 119, 0, 5, 0, 135, 2, 3, 0, 128, 44, 0, 0, 0, 1, 44, 0, 119, 0, 116, 0, 1, 44, 0, 0, 132, 0, 0, 44, 1, 41, 178, 1, 135, 44, 2, 0, 41, 29, 0, 0, 130, 44, 0, 0, 0, 0, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 0, 1, 121, 44, 3, 0, 1, 14, 78, 0, 119, 0, 103, 0, 1, 44, 0, 0, 132, 0, 0, 44, 82, 41, 9, 0, 106, 41, 41, 8, 135, 44, 2, 0, 41, 9, 29, 0, 130, 44, 0, 0, 0, 0, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 0, 1, 121, 44, 5, 0, 135, 2, 3, 0, 128, 44, 0, 0, 0, 1, 44, 0, 119, 0, 87, 0, 85, 30, 40, 0, 106, 7, 30, 24, 0, 6, 7, 0, 121, 7, 14, 0, 25, 5, 30, 28, 82, 4, 5, 0, 46, 44, 4, 7, 192, 78, 0, 0, 26, 44, 4, 4, 4, 44, 44, 6, 43, 44, 44, 2, 11, 44, 44, 0, 41, 44, 44, 2, 3, 44, 4, 44, 85, 5, 44, 0, 135, 44, 10, 0, 7, 0, 0, 0, 106, 5, 30, 12, 0, 4, 5, 0, 121, 5, 14, 0, 25, 7, 30, 16, 82, 6, 7, 0, 46, 44, 6, 5, 0, 79, 0, 0, 26, 44, 6, 4, 4, 44, 44, 4, 43, 44, 44, 2, 11, 44, 44, 0, 41, 44, 44, 2, 3, 44, 6, 44, 85, 7, 44, 0, 135, 44, 10, 0, 5, 0, 0, 0, 135, 44, 39, 0, 31, 0, 0, 0, 135, 44, 40, 0, 33, 0, 0, 0, 135, 44, 41, 0, 34, 0, 0, 0, 135, 44, 42, 0, 35, 0, 0, 0, 135, 44, 5, 0, 21, 0, 0, 0, 135, 44, 5, 0, 23, 0, 0, 0, 25, 7, 36, 20, 25, 2, 36, 16, 82, 4, 2, 0, 82, 44, 7, 0, 4, 44, 44, 4, 42, 44, 44, 2, 0, 1, 44, 0, 121, 1, 14, 0, 1, 5, 0, 0, 41, 44, 5, 2, 94, 3, 4, 44, 121, 3, 7, 0, 82, 41, 3, 0, 106, 41, 41, 4, 19, 41, 41, 37, 135, 44, 43, 0, 41, 3, 0, 0, 82, 4, 2, 0, 25, 5, 5, 1, 53, 44, 5, 1, 92, 79, 0, 0, 0, 3, 4, 0, 121, 4, 13, 0, 82, 2, 7, 0, 46, 44, 2, 4, 188, 79, 0, 0, 26, 44, 2, 4, 4, 44, 44, 3, 43, 44, 44, 2, 11, 44, 44, 0, 41, 44, 44, 2, 3, 44, 2, 44, 85, 7, 44, 0, 135, 44, 10, 0, 4, 0, 0, 0, 82, 41, 22, 0, 135, 44, 44, 0, 36, 41, 0, 0, 0, 36, 9, 0, 137, 32, 0, 0, 139, 36, 0, 0, 32, 44, 14, 78, 121, 44, 4, 0, 135, 2, 3, 0, 128, 44, 0, 0, 0, 1, 44, 0, 85, 30, 40, 0, 106, 8, 30, 24, 0, 7, 8, 0, 121, 8, 14, 0], eb + 10240);
  HEAPU8.set([25, 6, 30, 28, 82, 5, 6, 0, 46, 44, 5, 8, 44, 80, 0, 0, 26, 44, 5, 4, 4, 44, 44, 7, 43, 44, 44, 2, 11, 44, 44, 0, 41, 44, 44, 2, 3, 44, 5, 44, 85, 6, 44, 0, 135, 44, 10, 0, 8, 0, 0, 0, 106, 5, 30, 12, 120, 5, 2, 0, 119, 0, 14, 0, 25, 7, 30, 16, 82, 6, 7, 0, 46, 44, 6, 5, 108, 80, 0, 0, 26, 44, 6, 4, 4, 44, 44, 5, 43, 44, 44, 2, 11, 44, 44, 0, 41, 44, 44, 2, 3, 44, 6, 44, 85, 7, 44, 0, 135, 44, 10, 0, 5, 0, 0, 0, 135, 44, 39, 0, 31, 0, 0, 0, 135, 44, 40, 0, 33, 0, 0, 0, 135, 44, 41, 0, 34, 0, 0, 0, 135, 44, 42, 0, 35, 0, 0, 0, 32, 44, 14, 58, 121, 44, 5, 0, 135, 2, 3, 0, 128, 44, 0, 0, 0, 1, 44, 0, 1, 14, 59, 0, 135, 44, 5, 0, 21, 0, 0, 0, 135, 44, 5, 0, 23, 0, 0, 0, 119, 0, 7, 0, 135, 44, 5, 0, 24, 0, 0, 0, 135, 44, 5, 0, 3, 0, 0, 0, 135, 44, 5, 0, 27, 0, 0, 0, 25, 8, 36, 20, 25, 6, 36, 16, 82, 3, 6, 0, 82, 44, 8, 0, 4, 44, 44, 3, 42, 44, 44, 2, 0, 7, 44, 0, 121, 7, 14, 0, 1, 5, 0, 0, 41, 44, 5, 2, 94, 4, 3, 44, 121, 4, 7, 0, 82, 41, 4, 0, 106, 41, 41, 4, 19, 41, 41, 37, 135, 44, 43, 0, 41, 4, 0, 0, 82, 3, 6, 0, 25, 5, 5, 1, 53, 44, 5, 7, 252, 80, 0, 0, 0, 1, 3, 0, 121, 3, 13, 0, 82, 4, 8, 0, 46, 44, 4, 3, 92, 81, 0, 0, 26, 44, 4, 4, 4, 44, 44, 1, 43, 44, 44, 2, 11, 44, 44, 0, 41, 44, 44, 2, 3, 44, 4, 44, 85, 8, 44, 0, 135, 44, 10, 0, 3, 0, 0, 0, 82, 41, 22, 0, 135, 44, 44, 0, 36, 41, 0, 0, 0, 36, 2, 0, 135, 44, 14, 0, 36, 0, 0, 0, 135, 44, 5, 0, 16, 0, 0, 0, 0, 36, 1, 0, 135, 44, 14, 0, 36, 0, 0, 0, 1, 44, 0, 0, 139, 44, 0, 0, 140, 5, 45, 0, 0, 0, 0, 0, 2, 38, 0, 0, 136, 0, 0, 0, 2, 39, 0, 0, 144, 1, 0, 0, 2, 40, 0, 0, 192, 0, 0, 0, 2, 41, 0, 0, 194, 0, 0, 0, 136, 42, 0, 0, 0, 35, 42, 0, 136, 42, 0, 0, 1, 43, 224, 0, 3, 42, 42, 43, 137, 42, 0, 0, 3, 26, 35, 40, 1, 42, 168, 0, 3, 22, 35, 42, 25, 37, 35, 56, 25, 27, 35, 36, 25, 36, 35, 12, 25, 23, 35, 120, 1, 42, 180, 0, 3, 32, 35, 42, 1, 42, 204, 0, 3, 24, 35, 42, 25, 25, 35, 48, 25, 33, 35, 68, 0, 30, 35, 0, 25, 31, 35, 92, 25, 34, 35, 80, 25, 28, 35, 24, 25, 29, 35, 104, 1, 43, 0, 0, 135, 42, 45, 0, 37, 1, 43, 0, 82, 1, 3, 0, 106, 13, 3, 4, 45, 42, 1, 13, 80, 82, 0, 0, 1, 36, 0, 0, 135, 42, 5, 0, 37, 0, 0, 0, 137, 35, 0, 0, 139, 36, 0, 0, 25, 14, 37, 8, 25, 15, 37, 1, 25, 16, 0, 48, 25, 17, 2, 68, 25, 18, 2, 72, 25, 19, 2, 76, 25, 20, 0, 116, 25, 21, 23, 12, 1, 3, 0, 0, 82, 5, 1, 0, 1, 42, 0, 0, 132, 0, 0, 42, 1, 42, 193, 0, 135, 6, 11, 0, 42, 5, 0, 0, 130, 42, 0, 0, 0, 12, 42, 0, 1, 42, 0, 0, 132, 0, 0, 42, 38, 42, 12, 1, 121, 42, 3, 0, 1, 1, 18, 0, 119, 0, 198, 1, 1, 42, 0, 0, 132, 0, 0, 42, 78, 43, 37, 0, 38, 43, 43, 1, 32, 43, 43, 0, 121, 43, 3, 0, 0, 42, 15, 0, 119, 0, 3, 0, 82, 43, 14, 0, 0, 42, 43, 0, 82, 43, 16, 0, 106, 43, 43, 20, 135, 12, 46, 0, 6, 42, 5, 43, 130, 43, 0, 0, 0, 11, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 11, 1, 121, 43, 3, 0, 1, 1, 18, 0, 119, 0, 176, 1, 121, 12, 169, 1, 82, 3, 12, 0, 121, 3, 149, 1, 0, 11, 12, 0, 1, 43, 0, 0, 132, 0, 0, 43, 135, 9, 11, 0, 41, 3, 0, 0, 130, 43, 0, 0, 0, 10, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 10, 1, 121, 43, 3, 0, 1, 1, 17, 0, 119, 0, 160, 1, 1, 43, 0, 0, 132, 0, 0, 43, 1, 43, 195, 0, 135, 10, 11, 0, 43, 3, 0, 0, 130, 43, 0, 0, 0, 8, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 8, 1, 121, 43, 3, 0, 1, 1, 17, 0, 119, 0, 147, 1, 1, 43, 0, 0, 132, 0, 0, 43, 1, 43, 196, 0, 135, 7, 11, 0, 43, 3, 0, 0, 130, 43, 0, 0, 0, 8, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 8, 1, 121, 43, 3, 0, 1, 1, 17, 0, 119, 0, 134, 1, 1, 43, 0, 0, 132, 0, 0, 43, 1, 43, 197, 0, 135, 8, 11, 0, 43, 3, 0, 0, 130, 43, 0, 0, 0, 6, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 6, 1, 121, 43, 3, 0, 1, 1, 17, 0, 119, 0, 121, 1, 1, 43, 0, 0, 132, 0, 0, 43, 1, 43, 198, 0, 135, 5, 11, 0, 43, 3, 0, 0, 130, 43, 0, 0, 0, 6, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 6, 1, 121, 43, 3, 0, 1, 1, 17, 0, 119, 0, 108, 1, 120, 5, 202, 0, 33, 6, 9, 0, 120, 10, 33, 0, 120, 6, 2, 0, 119, 0, 75, 1, 135, 10, 47, 0, 9, 0, 0, 0, 1, 43, 0, 0, 132, 0, 0, 43, 135, 43, 12, 0, 38, 29, 9, 10, 130, 43, 0, 0, 0, 10, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 10, 1, 121, 43, 3, 0, 1, 1, 17, 0, 119, 0, 89, 1, 1, 43, 0, 0, 132, 0, 0, 43, 1, 42, 195, 0, 135, 43, 12, 0, 42, 0, 2, 29, 130, 43, 0, 0, 0, 10, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 10, 1, 121, 43, 3, 0, 1, 1, 61, 0, 119, 0, 76, 1, 135, 43, 5, 0, 29, 0, 0, 0, 119, 0, 45, 1, 82, 5, 16, 0, 120, 6, 73, 0, 1, 43, 0, 0, 132, 0, 0, 43, 135, 43, 2, 0, 39, 34, 37, 0, 130, 43, 0, 0, 0, 9, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 9, 1, 121, 43, 3, 0, 1, 1, 17, 0, 119, 0, 59, 1, 1, 43, 0, 0, 132, 0, 0, 43, 135, 43, 2, 0, 39, 28, 37, 0, 130, 43, 0, 0, 0, 9, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 9, 1, 121, 43, 3, 0, 1, 1, 54, 0, 119, 0, 47, 1, 1, 43, 0, 0, 132, 0, 0, 43, 1, 42, 13, 0, 135, 43, 4, 0, 42, 5, 34, 28, 10, 0, 0, 0, 130, 43, 0, 0, 0, 10, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 10, 1, 121, 43, 3, 0, 1, 1, 55, 0, 119, 0, 33, 1, 135, 43, 5, 0, 28, 0, 0, 0, 135, 43, 5, 0, 34, 0, 0, 0, 82, 3, 18, 0, 1, 43, 0, 0, 132, 0, 0, 43, 82, 43, 19, 0, 45, 43, 3, 43, 144, 85, 0, 0, 135, 43, 48, 0, 17, 37, 0, 0, 130, 43, 0, 0, 0, 10, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 10, 1, 121, 43, 243, 0, 1, 1, 17, 0, 119, 0, 13, 1, 135, 43, 8, 0, 3, 37, 0, 0, 130, 43, 0, 0, 0, 10, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 10, 1, 121, 43, 3, 0, 1, 1, 17, 0, 119, 0, 3, 1, 82, 43, 18, 0, 25, 43, 43, 12, 85, 18, 43, 0, 119, 0, 227, 0, 135, 8, 47, 0, 9, 0, 0, 0, 1, 43, 0, 0, 132, 0, 0, 43, 135, 43, 12, 0, 38, 33, 9, 8, 130, 43, 0, 0, 0, 8, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 8, 1, 121, 43, 3, 0, 1, 1, 17, 0, 119, 0, 241, 0, 1, 43, 0, 0, 132, 0, 0, 43, 135, 43, 2, 0, 39, 30, 37, 0, 130, 43, 0, 0, 0, 8, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 8, 1, 121, 43, 3, 0, 1, 1, 43, 0, 119, 0, 229, 0, 1, 43, 0, 0, 132, 0, 0, 43, 1, 42, 13, 0, 135, 43, 4, 0, 42, 5, 33, 30, 10, 0, 0, 0, 130, 43, 0, 0, 0, 10, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 10, 1, 121, 43, 3, 0, 1, 1, 44, 0, 119, 0, 215, 0, 135, 43, 5, 0, 30, 0, 0, 0, 135, 43, 5, 0, 33, 0, 0, 0, 135, 10, 47, 0, 9, 0, 0, 0, 1, 43, 0, 0, 132, 0, 0, 43, 135, 43, 12, 0, 38, 31, 9, 10, 130, 43, 0, 0, 0, 10, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 10, 1, 121, 43, 3, 0, 1, 1, 17, 0, 119, 0, 197, 0, 82, 3, 18, 0, 82, 43, 19, 0, 48, 43, 3, 43, 252, 86, 0, 0, 116, 3, 31, 0, 106, 42, 31, 4, 109, 3, 4, 42, 106, 43, 31, 8, 109, 3, 8, 43, 1, 43, 0, 0, 85, 31, 43, 0, 1, 42, 0, 0, 109, 31, 4, 42, 1, 43, 0, 0, 109, 31, 8, 43, 82, 43, 18, 0, 25, 43, 43, 12, 85, 18, 43, 0, 119, 0, 14, 0, 1, 43, 0, 0, 132, 0, 0, 43, 1, 42, 146, 1, 135, 43, 2, 0, 42, 17, 31, 0, 130, 43, 0, 0, 0, 10, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 10, 1, 121, 43, 3, 0, 1, 1, 46, 0, 119, 0, 165, 0, 135, 43, 5, 0, 31, 0, 0, 0, 119, 0, 134, 0, 135, 6, 47, 0, 5, 0, 0, 0, 1, 43, 0, 0, 132, 0, 0, 43, 19, 43, 8, 7, 32, 43, 43, 255, 121, 43, 31, 0, 135, 43, 24, 0, 27, 5, 6, 0, 130, 43, 0, 0, 0, 10, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 10, 1, 121, 43, 3, 0, 1, 1, 17, 0, 119, 0, 145, 0, 1, 43, 0, 0, 132, 0, 0, 43, 116, 26, 20, 0, 106, 42, 20, 4, 109, 26, 4, 42, 106, 43, 20, 8, 109, 26, 8, 43, 135, 43, 12, 0, 40, 0, 27, 26, 130, 43, 0, 0, 0, 10, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 10, 1, 121, 43, 3, 0, 1, 1, 20, 0, 119, 0, 128, 0, 135, 43, 5, 0, 27, 0, 0, 0, 119, 0, 97, 0, 135, 43, 24, 0, 36, 5, 6, 0, 130, 43, 0, 0, 0, 9, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 9, 1, 121, 43, 3, 0, 1, 1, 17, 0, 119, 0, 115, 0, 135, 9, 47, 0, 5, 0, 0, 0, 1, 43, 0, 0, 132, 0, 0, 43, 135, 43, 12, 0, 38, 32, 5, 9, 130, 43, 0, 0, 0, 9, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 9, 1, 121, 43, 3, 0, 1, 1, 28, 0, 119, 0, 101, 0, 1, 43, 0, 0, 132, 0, 0, 43, 1, 42, 193, 0, 135, 43, 12, 0, 42, 24, 7, 8, 130, 43, 0, 0, 0, 9, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 9, 1, 121, 43, 3, 0, 1, 1, 29, 0, 119, 0, 88, 0, 1, 43, 0, 0, 132, 0, 0, 43, 1, 42, 0, 0, 1, 44, 0, 0, 135, 43, 12, 0, 41, 25, 42, 44, 130, 43, 0, 0, 0, 9, 43, 0, 1, 43, 0, 0, 132, 0, 0, 43, 38, 43, 9, 1, 121, 43, 3, 0, 1, 1, 29, 0, 119, 0, 74, 0, 1, 43, 0, 0, 132, 0, 0, 43, 116, 22, 24, 0, 106, 44, 24, 4, 109, 22, 4, 44, 106, 43, 24, 8, 109, 22, 8, 43, 116, 26, 25, 0, 106, 44, 25, 4, 109, 26, 4, 44, 1, 43, 17, 0, 135, 44, 38, 0, 43, 23, 32, 10, 22, 26, 0, 0, 130, 44, 0, 0, 0, 10, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 10, 1, 121, 44, 3, 0, 1, 1, 29, 0, 119, 0, 52, 0, 1, 44, 0, 0, 132, 0, 0, 44, 116, 26, 23, 0, 106, 43, 23, 4, 109, 26, 4, 43, 106, 44, 23, 8, 109, 26, 8, 44, 135, 44, 12, 0, 40, 0, 36, 26, 130, 44, 0, 0, 0, 10, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 10, 1, 121, 44, 3, 0, 1, 1, 30, 0, 119, 0, 35, 0, 135, 44, 5, 0, 21, 0, 0, 0, 135, 44, 5, 0, 32, 0, 0, 0, 135, 44, 5, 0, 36, 0, 0, 0, 25, 11, 11, 4, 82, 3, 11, 0, 33, 44, 3, 0, 120, 44, 110, 254, 1, 44, 0, 0, 132, 0, 0, 44, 1, 43, 73, 1, 135, 44, 37, 0, 43, 12, 0, 0, 130, 44, 0, 0, 0, 12, 44, 0, 1, 44, 0, 0, 132, 0, 0, 44, 38, 44, 12, 1, 121, 44, 3, 0, 1, 1, 18, 0, 119, 0, 12, 0, 121, 4, 4, 0, 1, 3, 1, 0, 1, 1, 66, 0, 119, 0, 8, 0, 1, 3, 1, 0, 25, 1, 1, 4, 45, 44, 1, 13, 188, 89, 0, 0, 1, 1, 66, 0, 119, 0, 2, 0, 119, 0, 46, 254, 1, 44, 17, 0, 1, 43, 50, 0, 138, 1, 44, 43, 152, 90, 0, 0, 164, 90, 0, 0, 148, 90, 0, 0, 176, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 208, 90, 0, 0, 216, 90, 0, 0, 228, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 248, 90, 0, 0, 4, 91, 0, 0, 148, 90, 0, 0, 24, 91, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 56, 91, 0, 0, 68, 91, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 88, 91, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 148, 90, 0, 0, 120, 91, 0, 0, 119, 0, 62, 0, 135, 3, 3, 0, 1, 1, 19, 0, 119, 0, 59, 0, 135, 3, 3, 0, 1, 1, 19, 0, 119, 0, 56, 0, 135, 36, 3, 0, 135, 44, 5, 0, 27, 0, 0, 0, 135, 44, 5, 0, 37, 0, 0, 0, 135, 44, 14, 0, 36, 0, 0, 0, 119, 0, 1, 0, 135, 3, 3, 0, 119, 0, 46, 0, 135, 3, 3, 0, 1, 1, 31, 0, 119, 0, 43, 0, 135, 3, 3, 0, 135, 44, 5, 0, 21, 0, 0, 0, 1, 1, 31, 0, 119, 0, 38, 0, 135, 3, 3, 0, 1, 1, 45, 0, 119, 0, 35, 0, 135, 3, 3, 0, 135, 44, 5, 0, 30, 0, 0, 0, 1, 1, 45, 0, 119, 0, 30, 0, 135, 36, 3, 0, 135, 44, 5, 0, 31, 0, 0, 0, 135, 44, 5, 0, 37, 0, 0, 0, 135, 44, 14, 0, 36, 0, 0, 0, 119, 0, 1, 0, 135, 3, 3, 0, 1, 1, 56, 0, 119, 0, 19, 0, 135, 3, 3, 0, 135, 44, 5, 0, 28, 0, 0, 0, 1, 1, 56, 0, 119, 0, 14, 0, 135, 36, 3, 0, 135, 44, 5, 0, 29, 0, 0, 0, 135, 44, 5, 0, 37, 0, 0, 0, 135, 44, 14, 0, 36, 0, 0, 0, 119, 0, 1, 0, 135, 44, 5, 0, 37, 0, 0, 0, 137, 35, 0, 0, 139, 3, 0, 0, 119, 0, 1, 0, 32, 44, 1, 19, 121, 44, 7, 0, 0, 36, 3, 0, 135, 44, 5, 0, 37, 0, 0, 0, 135, 44, 14, 0, 36, 0, 0, 0, 119, 0, 25, 0, 32, 44, 1, 31, 121, 44, 4, 0, 135, 44, 5, 0, 32, 0, 0, 0, 119, 0, 20, 0, 32, 44, 1, 45, 121, 44, 9, 0, 135, 44, 5, 0, 33, 0, 0, 0, 0, 36, 3, 0, 135, 44, 5, 0, 37, 0, 0, 0, 135, 44, 14, 0, 36, 0, 0, 0, 119, 0, 10, 0, 32, 44, 1, 56, 121, 44, 8, 0, 135, 44, 5, 0, 34, 0, 0, 0, 0, 36, 3, 0, 135, 44, 5, 0, 37, 0, 0, 0, 135, 44, 14, 0, 36, 0, 0, 0, 135, 44, 5, 0, 36, 0, 0, 0, 0, 36, 3, 0, 135, 44, 5, 0, 37, 0, 0, 0, 135, 44, 14, 0, 36, 0, 0, 0, 1, 44, 0, 0, 139, 44, 0, 0, 140, 1, 27, 0, 0, 0, 0, 0, 2, 21, 0, 0, 255, 0, 0, 0, 2, 22, 0, 0, 196, 0, 0, 0, 2, 23, 0, 0, 64, 163, 0, 0, 136, 24, 0, 0, 0, 20, 24, 0, 136, 24, 0, 0, 25, 24, 24, 48, 137, 24, 0, 0, 25, 19, 20, 24, 25, 18, 20, 12, 0, 15, 20, 0, 120, 0, 4, 0, 1, 0, 1, 0, 137, 20, 0, 0, 139, 0, 0, 0, 82, 1, 0, 0, 32, 24, 1, 1, 121, 24, 5, 0, 1, 0, 0, 0, 137, 20, 0, 0, 139, 0, 0, 0, 119, 0, 102, 1, 120, 1, 98, 1, 106, 16, 0, 4, 120, 16, 4, 0, 1, 0, 1, 0, 137, 20, 0, 0, 139, 0, 0, 0, 106, 3, 0, 8, 120, 3, 4, 0, 1, 0, 1, 0, 137, 20, 0, 0, 139, 0, 0, 0, 106, 1, 16, 80, 121, 1, 4, 0, 0, 0, 1, 0, 137, 20, 0, 0, 139, 0, 0, 0, 109, 3, 20, 0, 1, 24, 1, 0, 85, 0, 24, 0, 106, 13, 16, 16, 32, 24, 13, 0, 2, 25, 0, 0, 8, 208, 0, 0, 125, 13, 24, 25, 13, 0, 0, 0, 135, 14, 47, 0, 13, 0, 0, 0, 1, 25, 0, 0, 132, 0, 0, 25, 1, 24, 136, 0, 135, 25, 12, 0, 24, 19, 13, 14, 130, 25, 0, 0, 0, 14, 25, 0, 1, 25, 0, 0, 132, 0, 0, 25, 38, 25, 14, 1, 121, 25, 6, 0, 1, 25, 0, 0, 135, 1, 49, 0, 25, 0, 0, 0, 1, 14, 49, 0, 119, 0, 254, 0, 106, 13, 16, 20, 32, 25, 13, 0, 2, 24, 0, 0, 8, 208, 0, 0, 125, 13, 25, 24, 13, 0, 0, 0, 135, 14, 47, 0, 13, 0, 0, 0, 1, 24, 0, 0, 132, 0, 0, 24, 1, 25, 136, 0, 135, 24, 12, 0, 25, 18, 13, 14, 130, 24, 0, 0, 0, 14, 24, 0, 1, 24, 0, 0, 132, 0, 0, 24, 38, 24, 14, 1, 121, 24, 5, 0, 1, 24, 0, 0, 135, 1, 49, 0, 24, 0, 0, 0, 119, 0, 228, 0, 106, 2, 16, 68, 32, 24, 2, 2, 121, 24, 18, 0, 1, 24, 0, 0, 132, 0, 0, 24, 1, 24, 221, 0, 135, 2, 11, 0, 24, 3, 0, 0, 130, 24, 0, 0, 0, 14, 24, 0, 1, 24, 0, 0, 132, 0, 0, 24, 38, 24, 14, 1, 121, 24, 3, 0, 1, 14, 13, 0, 119, 0, 26, 0, 0, 12, 2, 0, 1, 2, 1, 0, 1, 14, 15, 0, 119, 0, 22, 0, 32, 24, 2, 1, 121, 24, 18, 0, 1, 24, 0, 0, 132, 0, 0, 24, 1, 24, 220, 0, 135, 2, 11, 0, 24, 3, 0, 0, 130, 24, 0, 0, 0, 14, 24, 0, 1, 24, 0, 0, 132, 0, 0, 24, 38, 24, 14, 1, 121, 24, 3, 0, 1, 14, 13, 0, 119, 0, 7, 0, 0, 12, 2, 0, 1, 2, 0, 0, 1, 14, 15, 0, 119, 0, 3, 0, 1, 1, 0, 0, 1, 14, 46, 0, 32, 24, 14, 15, 121, 24, 169, 0, 120, 12, 4, 0, 1, 1, 0, 0, 1, 14, 46, 0, 119, 0, 165, 0, 1, 24, 0, 0, 132, 0, 0, 24, 1, 25, 205, 0, 82, 26, 3, 0, 3, 26, 26, 2, 135, 24, 12, 0, 25, 15, 3, 26, 130, 24, 0, 0, 0, 13, 24, 0, 1, 24, 0, 0, 132, 0, 0, 24, 38, 24, 13, 1, 121, 24, 3, 0, 1, 14, 13, 0, 119, 0, 150, 0, 25, 9, 16, 112, 25, 13, 15, 4, 82, 3, 15, 0, 82, 24, 13, 0, 4, 2, 24, 3, 28, 10, 2, 12, 41, 24, 10, 2, 25, 24, 24, 4, 135, 11, 50, 0, 24, 0, 0, 0, 120, 11, 14, 0, 1, 24, 4, 0, 135, 12, 51, 0, 24, 0, 0, 0, 135, 24, 52, 0, 12, 0, 0, 0, 1, 24, 0, 0, 132, 0, 0, 24, 1, 26, 138, 0, 135, 24, 12, 0, 26, 12, 23, 22, 1, 24, 0, 0, 132, 0, 0, 24, 119, 0, 108, 0, 1, 24, 0, 0, 47, 24, 24, 2, 68, 96, 0, 0, 0, 1, 3, 0, 1, 3, 0, 0, 27, 24, 3, 12, 3, 4, 1, 24, 78, 2, 4, 0, 38, 24, 2, 1, 120, 24, 5, 0, 19, 24, 2, 21, 43, 24, 24, 1, 0, 2, 24, 0, 119, 0, 4, 0, 27, 24, 3, 12, 3, 24, 1, 24, 106, 2, 24, 4, 25, 24, 2, 1, 135, 5, 50, 0, 24, 0, 0, 0, 41, 24, 3, 2, 3, 8, 11, 24, 85, 8, 5, 0, 120, 5, 2, 0, 119, 0, 45, 0, 78, 2, 4, 0, 38, 24, 2, 1, 120, 24, 6, 0, 25, 6, 4, 1, 19, 24, 2, 21, 43, 24, 24, 1, 0, 4, 24, 0, 119, 0, 5, 0, 27, 24, 3, 12, 3, 4, 1, 24, 106, 6, 4, 8, 106, 4, 4, 4, 3, 7, 6, 4, 121, 4, 14, 0, 0, 1, 5, 0, 0, 2, 6, 0, 78, 24, 2, 0, 83, 1, 24, 0, 25, 2, 2, 1, 52, 24, 2, 7, 188, 95, 0, 0, 25, 1, 1, 1, 119, 0, 250, 255, 82, 2, 15, 0, 0, 1, 2, 0, 27, 24, 3, 12, 90, 2, 2, 24, 38, 24, 2, 1, 120, 24, 5, 0, 19, 24, 2, 21, 43, 24, 24, 1, 0, 2, 24, 0, 119, 0, 4, 0, 27, 24, 3, 12, 3, 24, 1, 24, 106, 2, 24, 4, 82, 24, 8, 0, 1, 26, 0, 0, 95, 24, 2, 26, 25, 3, 3, 1, 56, 26, 10, 3, 68, 96, 0, 0, 82, 1, 15, 0, 119, 0, 193, 255, 1, 26, 4, 0, 135, 12, 51, 0, 26, 0, 0, 0, 135, 26, 52, 0, 12, 0, 0, 0, 1, 26, 0, 0, 132, 0, 0, 26, 1, 24, 138, 0, 135, 26, 12, 0, 24, 12, 23, 22, 1, 26, 0, 0, 132, 0, 0, 26, 119, 0, 26, 0, 41, 26, 10, 2, 1, 24, 0, 0, 97, 11, 26, 24, 85, 9, 11, 0, 82, 1, 15, 0, 120, 1, 4, 0, 0, 1, 12, 0, 1, 14, 46, 0, 119, 0, 35, 0, 82, 2, 13, 0, 46, 24, 2, 1, 148, 96, 0, 0, 26, 17, 2, 12, 85, 13, 17, 0, 135, 24, 5, 0, 17, 0, 0, 0, 82, 2, 13, 0, 53, 24, 2, 1, 116, 96, 0, 0, 82, 1, 15, 0, 135, 24, 10, 0, 1, 0, 0, 0, 0, 1, 12, 0, 1, 14, 46, 0, 119, 0, 19, 0, 1, 24, 0, 0, 135, 1, 49, 0, 24, 0, 0, 0, 82, 2, 15, 0, 121, 2, 14, 0, 82, 3, 13, 0, 46, 24, 3, 2, 232, 96, 0, 0, 26, 12, 3, 12, 85, 13, 12, 0, 135, 24, 5, 0, 12, 0, 0, 0, 82, 3, 13, 0, 53, 24, 3, 2, 200, 96, 0, 0, 82, 2, 15, 0, 135, 24, 10, 0, 2, 0, 0, 0, 32, 24, 14, 13, 121, 24, 5, 0, 1, 24, 0, 0, 135, 1, 49, 0, 24, 0, 0, 0, 119, 0, 9, 0, 32, 24, 14, 46, 121, 24, 7, 0, 135, 24, 5, 0, 18, 0, 0, 0, 135, 24, 5, 0, 19, 0, 0, 0, 0, 17, 1, 0, 119, 0, 6, 0, 135, 24, 5, 0, 18, 0, 0, 0, 135, 24, 5, 0, 19, 0, 0, 0, 1, 14, 49, 0, 32, 24, 14, 49, 121, 24, 52, 0, 135, 24, 53, 0, 1, 0, 0, 0, 1, 24, 0, 0, 132, 0, 0, 24, 1, 26, 219, 0, 135, 24, 11, 0, 26, 16, 0, 0, 130, 24, 0, 0, 0, 19, 24, 0, 1, 24, 0, 0, 132, 0, 0, 24, 38, 24, 19, 1, 121, 24, 23, 0, 135, 1, 3, 0, 1, 24, 0, 0, 132, 0, 0, 24, 1, 26, 4, 0, 135, 24, 54, 0, 26, 0, 0, 0, 130, 24, 0, 0, 0, 19, 24, 0, 1, 24, 0, 0, 132, 0, 0, 24, 38, 24, 19, 1, 121, 24, 7, 0, 1, 24, 0, 0, 135, 19, 49, 0, 24, 0, 0, 0, 135, 24, 55, 0, 19, 0, 0, 0, 119, 0, 21, 0, 0, 19, 1, 0, 135, 24, 56, 0, 19, 0, 0, 0, 119, 0, 17, 0, 1, 24, 0, 0, 132, 0, 0, 24, 1, 26, 4, 0, 135, 24, 54, 0, 26, 0, 0, 0, 130, 24, 0, 0, 0, 19, 24, 0, 1, 24, 0, 0, 132, 0, 0, 24, 38, 24, 19, 1, 120, 24, 3, 0, 1, 17, 0, 0, 119, 0, 4, 0, 135, 19, 3, 0, 135, 24, 56, 0, 19, 0, 0, 0, 109, 0, 12, 17, 1, 0, 0, 0, 137, 20, 0, 0, 139, 0, 0, 0, 119, 0, 4, 0, 1, 0, 255, 255, 137, 20, 0, 0, 139, 0, 0, 0, 1, 24, 0, 0, 139, 24, 0, 0, 140, 1, 15, 0, 0, 0, 0, 0, 136, 12, 0, 0, 0, 10, 12, 0, 136, 12, 0, 0, 25, 12, 12, 64, 137, 12, 0, 0, 25, 5, 10, 48, 25, 9, 10, 36, 25, 6, 10, 24, 25, 7, 10, 12, 0, 3, 10, 0, 25, 8, 0, 24, 82, 12, 8, 0, 120, 12, 4, 0, 1, 0, 0, 0, 137, 10, 0, 0, 139, 0, 0, 0, 106, 4, 0, 88, 25, 2, 0, 92, 82, 1, 2, 0, 46, 12, 1, 4, 188, 98, 0, 0, 26, 11, 1, 28, 85, 2, 11, 0, 26, 13, 1, 16, 135, 12, 5, 0, 13, 0, 0, 0, 135, 12, 5, 0, 11, 0, 0, 0, 82, 1, 2, 0, 53, 12, 1, 4, 148, 98, 0, 0, 1, 12, 95, 1, 90, 12, 0, 12, 120, 12, 49, 0, 1, 12, 36, 1, 3, 11, 0, 12, 135, 12, 8, 0, 7, 11, 0, 0, 1, 12, 0, 0, 132, 0, 0, 12, 1, 13, 144, 1, 135, 12, 2, 0, 13, 3, 11, 0, 130, 12, 0, 0, 0, 11, 12, 0, 1, 12, 0, 0, 132, 0, 0, 12, 38, 12, 11, 1, 121, 12, 3, 0, 135, 1, 3, 0, 119, 0, 27, 0, 1, 12, 0, 0, 132, 0, 0, 12, 1, 13, 13, 0, 82, 14, 8, 0, 135, 12, 4, 0, 13, 0, 7, 3, 14, 0, 0, 0, 130, 12, 0, 0, 0, 11, 12, 0, 1, 12, 0, 0, 132, 0, 0, 12, 38, 12, 11, 1, 121, 12, 5, 0, 135, 1, 3, 0, 135, 12, 5, 0, 3, 0, 0, 0, 119, 0, 10, 0, 135, 12, 5, 0, 3, 0, 0, 0, 135, 12, 5, 0, 7, 0, 0, 0, 134, 11, 0, 0, 160, 67, 0, 0, 0, 0, 0, 0, 137, 10, 0, 0, 139, 11, 0, 0, 135, 12, 5, 0, 7, 0, 0, 0, 0, 11, 1, 0, 135, 12, 14, 0, 11, 0, 0, 0, 82, 1, 8, 0, 135, 14, 47, 0, 1, 0, 0, 0, 135, 12, 24, 0, 5, 1, 14, 0, 1, 12, 0, 0, 132, 0, 0, 12, 1, 12, 244, 2, 1, 14, 33, 0, 135, 1, 15, 0, 12, 5, 14, 0, 130, 14, 0, 0, 0, 11, 14, 0, 1, 14, 0, 0, 132, 0, 0, 14, 38, 14, 11, 1, 121, 14, 6, 0, 135, 11, 3, 0, 135, 14, 5, 0, 5, 0, 0, 0, 135, 14, 14, 0, 11, 0, 0, 0, 135, 14, 5, 0, 5, 0, 0, 0, 1, 14, 36, 1, 3, 11, 0, 14, 135, 14, 8, 0, 9, 11, 0, 0, 1, 14, 0, 0, 132, 0, 0, 14, 1, 12, 144, 1, 135, 14, 2, 0, 12, 6, 11, 0, 130, 14, 0, 0, 0, 11, 14, 0, 1, 14, 0, 0, 132, 0, 0, 14, 38, 14, 11, 1, 121, 14, 3, 0, 135, 1, 3, 0, 119, 0, 30, 0, 1, 14, 0, 0, 132, 0, 0, 14, 1, 12, 13, 0, 135, 14, 4, 0, 12, 0, 9, 6, 1, 0, 0, 0, 130, 14, 0, 0, 0, 11, 14, 0, 1, 14, 0, 0, 132, 0, 0, 14, 38, 14, 11, 1, 121, 14, 5, 0, 135, 1, 3, 0, 135, 14, 5, 0, 6, 0, 0, 0, 119, 0, 14, 0, 135, 14, 5, 0, 6, 0, 0, 0, 135, 14, 5, 0, 9, 0, 0, 0, 82, 1, 8, 0, 121, 1, 3, 0, 135, 14, 57, 0, 1, 0, 0, 0, 134, 11, 0, 0, 160, 67, 0, 0, 0, 0, 0, 0, 137, 10, 0, 0, 139, 11, 0, 0, 135, 14, 5, 0, 9, 0, 0, 0, 0, 11, 1, 0, 135, 14, 14, 0, 11, 0, 0, 0, 1, 14, 0, 0, 139, 14, 0, 0, 140, 1, 11, 0, 0, 0, 0, 0, 2, 5, 0, 0, 24, 164, 0, 0, 2, 6, 0, 0, 162, 1, 0, 0, 2, 7, 0, 0, 200, 0, 0, 0, 136, 8, 0, 0, 0, 3, 8, 0, 136, 8, 0, 0, 1, 9, 48, 1, 3, 8, 8, 9, 137, 8, 0, 0, 1, 8, 148, 0, 3, 4, 3, 8, 0, 2, 3, 0, 120, 0, 4, 0, 1, 4, 1, 0, 137, 3, 0, 0, 139, 4, 0, 0, 106, 1, 0, 80, 121, 1, 4, 0, 0, 4, 1, 0, 137, 3, 0, 0, 139, 4, 0, 0, 1, 9, 0, 0, 1, 10, 148, 0, 135, 8, 58, 0, 4, 9, 10, 0, 106, 1, 0, 116, 120, 1, 33, 0, 1, 8, 8, 0, 135, 1, 51, 0, 8, 0, 0, 0, 1, 8, 0, 0, 132, 0, 0, 8, 2, 10, 0, 0, 144, 147, 0, 0, 135, 8, 2, 0, 6, 1, 10, 0, 130, 8, 0, 0, 0, 2, 8, 0, 1, 8, 0, 0, 132, 0, 0, 8, 38, 8, 2, 1, 121, 8, 9, 0, 1, 8, 0, 0, 135, 2, 49, 0, 8, 0, 0, 0, 135, 8, 59, 0, 1, 0, 0, 0, 0, 1, 2, 0, 1, 2, 12, 0, 119, 0, 80, 0, 1, 8, 0, 0, 132, 0, 0, 8, 1, 10, 138, 0, 135, 8, 12, 0, 10, 1, 5, 7, 1, 8, 0, 0, 132, 0, 0, 8, 1, 2, 7, 0, 119, 0, 71, 0, 78, 8, 1, 0, 120, 8, 33, 0, 1, 8, 8, 0, 135, 1, 51, 0, 8, 0, 0, 0, 1, 8, 0, 0, 132, 0, 0, 8, 2, 10, 0, 0, 184, 147, 0, 0, 135, 8, 2, 0, 6, 1, 10, 0, 130, 8, 0, 0, 0, 2, 8, 0, 1, 8, 0, 0, 132, 0, 0, 8, 38, 8, 2, 1, 121, 8, 9, 0, 1, 8, 0, 0, 135, 2, 49, 0, 8, 0, 0, 0, 135, 8, 59, 0, 1, 0, 0, 0, 0, 1, 2, 0, 1, 2, 12, 0, 119, 0, 46, 0, 1, 8, 0, 0, 132, 0, 0, 8, 1, 10, 138, 0, 135, 8, 12, 0, 10, 1, 5, 7, 1, 8, 0, 0, 132, 0, 0, 8, 1, 2, 7, 0, 119, 0, 37, 0, 109, 4, 8, 1, 1, 8, 0, 0, 132, 0, 0, 8, 1, 10, 247, 1, 135, 8, 2, 0, 10, 2, 4, 0, 130, 8, 0, 0, 0, 1, 8, 0, 1, 8, 0, 0, 132, 0, 0, 8, 38, 8, 1, 1, 121, 8, 3, 0, 1, 2, 16, 0, 119, 0, 23, 0, 1, 8, 0, 0, 132, 0, 0, 8, 1, 8, 58, 3, 135, 1, 15, 0, 8, 0, 2, 0, 130, 8, 0, 0, 0, 0, 8, 0, 1, 8, 0, 0, 132, 0, 0, 8, 38, 8, 0, 1, 120, 8, 5, 0, 135, 8, 60, 0, 2, 0, 0, 0, 1, 2, 20, 0, 119, 0, 8, 0, 135, 3, 3, 0, 135, 8, 60, 0, 2, 0, 0, 0, 135, 8, 60, 0, 4, 0, 0, 0, 135, 8, 14, 0, 3, 0, 0, 0, 32, 8, 2, 7, 121, 8, 5, 0, 1, 8, 0, 0, 135, 1, 49, 0, 8, 0, 0, 0, 1, 2, 12, 0, 32, 8, 2, 12, 121, 8, 54, 0, 135, 8, 53, 0, 1, 0, 0, 0, 1, 8, 0, 0, 132, 0, 0, 8, 1, 8, 219, 0, 135, 1, 11, 0, 8, 0, 0, 0, 130, 8, 0, 0, 0, 0, 8, 0, 1, 8, 0, 0, 132, 0, 0, 8, 38, 8, 0, 1, 120, 8, 18, 0, 1, 8, 0, 0, 132, 0, 0, 8, 1, 10, 4, 0, 135, 8, 54, 0, 10, 0, 0, 0, 130, 8, 0, 0, 0, 0, 8, 0, 1, 8, 0, 0, 132, 0, 0, 8, 38, 8, 0, 1, 121, 8, 3, 0, 1, 2, 16, 0, 119, 0, 28, 0, 39, 8, 1, 1, 0, 1, 8, 0, 1, 2, 20, 0, 119, 0, 24, 0, 135, 1, 3, 0, 1, 8, 0, 0, 132, 0, 0, 8, 1, 10, 4, 0, 135, 8, 54, 0, 10, 0, 0, 0, 130, 8, 0, 0, 0, 3, 8, 0, 1, 8, 0, 0, 132, 0, 0, 8, 38, 8, 3, 1, 121, 8, 7, 0, 1, 8, 0, 0, 135, 4, 49, 0, 8, 0, 0, 0, 135, 8, 55, 0, 4, 0, 0, 0, 119, 0, 6, 0, 0, 3, 1, 0, 135, 8, 60, 0, 4, 0, 0, 0, 135, 8, 14, 0, 3, 0, 0, 0, 32, 8, 2, 16, 121, 8, 7, 0, 135, 3, 3, 0, 135, 8, 60, 0, 4, 0, 0, 0, 135, 8, 14, 0, 3, 0, 0, 0, 119, 0, 8, 0, 32, 8, 2, 20, 121, 8, 6, 0, 135, 8, 60, 0, 4, 0, 0, 0, 0, 4, 1, 0, 137, 3, 0, 0, 139, 4, 0, 0, 1, 8, 0, 0, 139, 8, 0, 0, 140, 17, 23, 0, 0, 0, 0, 0, 135, 0, 61, 0, 0, 0, 0, 0, 121, 2, 7, 0, 135, 19, 62, 0, 0, 0, 0, 0, 135, 17, 63, 0, 19, 0, 0, 0, 1, 18, 0, 0, 119, 0, 6, 0, 135, 18, 64, 0, 0, 0, 0, 0, 135, 17, 65, 0, 18, 0, 0, 0, 1, 19, 0, 0, 135, 0, 66, 0, 17, 0, 0, 0, 1, 20, 255, 255, 47, 20, 20, 5, 104, 104, 0, 0, 135, 20, 67, 0, 0, 5, 0, 0, 135, 20, 68, 0, 0, 4, 0, 0, 135, 20, 69, 0, 0, 6, 0, 0, 135, 20, 70, 0, 0, 9, 0, 0, 135, 20, 71, 0, 0, 8, 0, 0, 135, 20, 72, 0, 0, 10, 0, 0, 135, 20, 73, 0, 0, 7, 0, 0, 135, 20, 74, 0, 0, 15, 0, 0, 135, 20, 75, 0, 0, 16, 0, 0, 135, 20, 76, 0, 0, 13, 0, 0, 135, 20, 77, 0, 0, 14, 0, 0, 135, 20, 78, 0, 0, 1, 0, 0, 135, 20, 79, 0, 0, 12, 0, 0, 135, 20, 80, 0, 0, 11, 0, 0, 121, 3, 12, 0, 1, 20, 1, 0, 135, 11, 81, 0, 20, 0, 0, 0, 1, 20, 49, 0, 59, 21, 0, 0, 1, 22, 0, 0, 135, 12, 82, 0, 20, 21, 22, 0, 85, 11, 12, 0, 135, 22, 83, 0, 0, 11, 0, 0, 121, 2, 4, 0, 135, 0, 84, 0, 19, 0, 0, 0, 119, 0, 4, 0, 134, 0, 0, 0, 188, 100, 0, 0, 18, 0, 0, 0, 120, 0, 11, 0, 135, 12, 85, 0, 17, 0, 0, 0, 135, 11, 86, 0, 17, 0, 0, 0, 1, 21, 0, 0, 135, 20, 87, 0, 17, 0, 0, 0, 135, 22, 88, 0, 21, 12, 11, 20, 119, 0, 8, 0, 135, 11, 89, 0, 17, 0, 0, 0, 1, 20, 1, 0, 135, 21, 90, 0, 17, 0, 0, 0, 135, 22, 91, 0, 20, 11, 21, 0, 121, 2, 5, 0, 135, 22, 92, 0, 19, 0, 0, 0, 139, 0, 0, 0, 119, 0, 4, 0, 135, 22, 93, 0, 18, 0, 0, 0, 139, 0, 0, 0, 139, 0, 0, 0, 140, 2, 7, 0, 0, 0, 0, 0, 136, 5, 0, 0, 0, 3, 5, 0, 136, 5, 0, 0, 1, 6, 160, 0, 3, 5, 5, 6, 137, 5, 0, 0, 0, 4, 3, 0, 135, 5, 94, 0, 4, 1, 0, 0, 135, 2, 95, 0, 0, 4, 0, 0, 135, 5, 60, 0, 4, 0, 0, 0, 134, 5, 0, 0, 48, 92, 0, 0, 2, 0, 0, 0, 1, 5, 0, 0, 132, 0, 0, 5, 1, 6, 223, 0, 135, 5, 11, 0, 6, 2, 0, 0, 130, 5, 0, 0, 0, 1, 5, 0, 1, 5, 0, 0, 132, 0, 0, 5, 38, 5, 1, 1, 121, 5, 39, 0, 1, 5, 0, 0, 135, 4, 49, 0, 5, 0, 0, 0, 135, 5, 53, 0, 4, 0, 0, 0, 1, 5, 0, 0, 132, 0, 0, 5, 1, 6, 219, 0, 135, 5, 11, 0, 6, 0, 0, 0, 130, 5, 0, 0, 0, 4, 5, 0, 1, 5, 0, 0, 132, 0, 0, 5, 38, 5, 4, 1, 120, 5, 3, 0, 135, 5, 96, 0, 119, 0, 21, 0, 135, 1, 3, 0, 1, 5, 0, 0, 132, 0, 0, 5, 1, 6, 4, 0, 135, 5, 54, 0, 6, 0, 0, 0, 130, 5, 0, 0, 0, 4, 5, 0, 1, 5, 0, 0, 132, 0, 0, 5, 38, 5, 4, 1, 121, 5, 7, 0, 1, 5, 0, 0, 135, 4, 49, 0, 5, 0, 0, 0, 135, 5, 55, 0, 4, 0, 0, 0, 119, 0, 3, 0, 135, 5, 14, 0, 1, 0, 0, 0, 120, 2, 5, 0, 25, 4, 0, 80, 82, 4, 4, 0, 137, 3, 0, 0, 139, 4, 0, 0, 25, 4, 2, 8, 82, 1, 4, 0, 1, 5, 0, 0, 85, 4, 5, 0, 121, 1, 5, 0, 135, 5, 97, 0, 1, 0, 0, 0, 135, 5, 10, 0, 1, 0, 0, 0, 135, 5, 98, 0, 2, 0, 0, 0, 25, 4, 0, 80, 82, 4, 4, 0, 137, 3, 0, 0, 139, 4, 0, 0, 140, 3, 8, 0, 0, 0, 0, 0, 1, 5, 2, 0, 135, 7, 99, 0, 2, 0, 0, 0, 135, 6, 100, 0, 7, 0, 0, 0, 135, 4, 91, 0, 5, 0, 6, 0, 1, 6, 3, 0, 1, 5, 0, 0, 135, 4, 101, 0, 6, 5, 0, 0, 120, 4, 10, 0, 1, 5, 20, 0, 135, 4, 102, 0, 5, 0, 0, 0, 1, 5, 3, 0, 1, 6, 0, 0, 135, 4, 101, 0, 5, 6, 0, 0, 32, 4, 4, 0, 120, 4, 248, 255, 1, 4, 4, 0, 1, 6, 0, 0, 135, 1, 101, 0, 4, 6, 0, 0, 121, 1, 17, 0, 1, 6, 1, 0, 135, 3, 103, 0, 6, 0, 0, 0, 1, 6, 0, 0, 1, 4, 0, 0, 135, 0, 104, 0, 0, 6, 4, 0, 85, 3, 0, 0, 135, 6, 61, 0, 1, 0, 0, 0, 1, 5, 0, 0, 1, 7, 0, 0, 135, 4, 105, 0, 0, 6, 5, 7, 0, 0, 3, 0, 139, 0, 0, 0, 1, 4, 5, 0, 1, 7, 0, 0, 135, 2, 101, 0, 4, 7, 0, 0, 1, 7, 6, 0, 1, 4, 0, 0, 135, 1, 101, 0, 7, 4, 0, 0, 20, 4, 1, 2, 120, 4, 3, 0, 1, 0, 0, 0, 139, 0, 0, 0, 1, 4, 1, 0, 135, 3, 103, 0, 4, 0, 0, 0, 33, 7, 2, 0, 125, 4, 7, 2, 0, 0, 0, 0, 135, 2, 61, 0, 4, 0, 0, 0, 120, 1, 3, 0, 1, 1, 0, 0, 119, 0, 3, 0, 135, 1, 61, 0, 1, 0, 0, 0, 1, 4, 0, 0, 135, 0, 104, 0, 2, 1, 4, 0, 85, 3, 0, 0, 0, 0, 3, 0, 139, 0, 0, 0], eb + 20480);
  var relocations = [];
  relocations = relocations.concat([360, 648, 760, 1160, 1228, 1308, 1344, 1488, 1616, 1936, 2092, 2248, 2272, 2284, 2352, 2456, 2480, 2492, 2560, 2756, 3376, 3756, 4148, 4468, 4788, 5108, 5428, 5748, 6068, 6388, 6768, 7140, 7680, 8036, 8344, 8576, 8764, 8792, 8932, 9032, 9352, 9508, 9572, 9760, 10120, 10148, 10176, 10220, 10244, 10256, 10324, 10396, 10420, 10432, 10500, 10840, 11504, 11748, 12144, 12456, 12928, 13240, 13584, 13896, 14176, 14232, 14332, 14356, 14524, 14596, 14696, 14720, 14880, 14884, 14888, 14892, 14896, 14900, 14904, 14908, 14912, 14916, 14920, 14924, 14928, 14932, 14936, 14940, 14944, 14948, 14952, 14956, 14960, 14964, 14968, 14972, 14976, 14980, 14984, 14988, 14992, 14996, 15e3, 15004, 15008, 15012, 15016, 15020, 15024, 15028, 15032, 15036, 15040, 15044, 15048, 15052, 15056, 15060, 15064, 15068, 15072, 15076, 15080, 15084, 15088, 15092, 15096, 15100, 15104, 15108, 15112, 15116, 15120, 15124, 15128, 15132, 15136, 15140, 15144, 15148, 15152, 15156, 15160, 15164, 15168, 15172, 15176, 15180, 15184, 15188, 15192, 15196, 15200, 15204, 15208, 15212, 15216, 15220, 15224, 15228, 15232, 15236, 15240, 15244, 15248, 15252, 15256, 15260, 15264, 15268, 15272, 15276, 15280, 15284, 15288, 15292, 15296, 15300, 15304, 15308, 15312, 15316, 15320, 15324, 15328, 15332, 15336, 15340, 15344, 15348, 15352, 15356, 15360, 15364, 15368, 15372, 15376, 15380, 15384, 15388, 15392, 15396, 15400, 15452, 16236, 16260, 16272, 16340, 16448, 16472, 16484, 16552, 16628, 16652, 16664, 16732, 16796, 16812, 16836, 16848, 16916, 16980, 17004, 17016, 17084, 17148, 17172, 17184, 17252, 17512, 17712, 18152, 18212, 18284, 18380, 18440, 19208, 19864, 20128, 20192, 20360, 20380, 20492, 20556, 20776, 20796, 21048, 21860, 22204, 22960, 22988, 22992, 22996, 23e3, 23004, 23008, 23012, 23016, 23020, 23024, 23028, 23032, 23036, 23040, 23044, 23048, 23052, 23056, 23060, 23064, 23068, 23072, 23076, 23080, 23084, 23088, 23092, 23096, 23100, 23104, 23108, 23112, 23116, 23120, 23124, 23128, 23132, 23136, 23140, 23144, 23148, 23152, 23156, 23160, 23164, 23168, 23172, 23176, 23180, 23184, 24324, 24496, 24580, 24688, 24716, 24772, 24800, 25232, 25272, 26716, 25444, 25744, 26900, 27080]);
  for (var i = 0; i < relocations.length; i++) {
    HEAPU32[eb + relocations[i] >> 2] += eb
  }
}));

function _atexit(func, arg) {
  __ATEXIT__.unshift({
    func: func,
    arg: arg
  })
}

function ___cxa_atexit() {
  return _atexit.apply(null, arguments)
}
var ERRNO_CODES = {
  EPERM: 1,
  ENOENT: 2,
  ESRCH: 3,
  EINTR: 4,
  EIO: 5,
  ENXIO: 6,
  E2BIG: 7,
  ENOEXEC: 8,
  EBADF: 9,
  ECHILD: 10,
  EAGAIN: 11,
  EWOULDBLOCK: 11,
  ENOMEM: 12,
  EACCES: 13,
  EFAULT: 14,
  ENOTBLK: 15,
  EBUSY: 16,
  EEXIST: 17,
  EXDEV: 18,
  ENODEV: 19,
  ENOTDIR: 20,
  EISDIR: 21,
  EINVAL: 22,
  ENFILE: 23,
  EMFILE: 24,
  ENOTTY: 25,
  ETXTBSY: 26,
  EFBIG: 27,
  ENOSPC: 28,
  ESPIPE: 29,
  EROFS: 30,
  EMLINK: 31,
  EPIPE: 32,
  EDOM: 33,
  ERANGE: 34,
  ENOMSG: 42,
  EIDRM: 43,
  ECHRNG: 44,
  EL2NSYNC: 45,
  EL3HLT: 46,
  EL3RST: 47,
  ELNRNG: 48,
  EUNATCH: 49,
  ENOCSI: 50,
  EL2HLT: 51,
  EDEADLK: 35,
  ENOLCK: 37,
  EBADE: 52,
  EBADR: 53,
  EXFULL: 54,
  ENOANO: 55,
  EBADRQC: 56,
  EBADSLT: 57,
  EDEADLOCK: 35,
  EBFONT: 59,
  ENOSTR: 60,
  ENODATA: 61,
  ETIME: 62,
  ENOSR: 63,
  ENONET: 64,
  ENOPKG: 65,
  EREMOTE: 66,
  ENOLINK: 67,
  EADV: 68,
  ESRMNT: 69,
  ECOMM: 70,
  EPROTO: 71,
  EMULTIHOP: 72,
  EDOTDOT: 73,
  EBADMSG: 74,
  ENOTUNIQ: 76,
  EBADFD: 77,
  EREMCHG: 78,
  ELIBACC: 79,
  ELIBBAD: 80,
  ELIBSCN: 81,
  ELIBMAX: 82,
  ELIBEXEC: 83,
  ENOSYS: 38,
  ENOTEMPTY: 39,
  ENAMETOOLONG: 36,
  ELOOP: 40,
  EOPNOTSUPP: 95,
  EPFNOSUPPORT: 96,
  ECONNRESET: 104,
  ENOBUFS: 105,
  EAFNOSUPPORT: 97,
  EPROTOTYPE: 91,
  ENOTSOCK: 88,
  ENOPROTOOPT: 92,
  ESHUTDOWN: 108,
  ECONNREFUSED: 111,
  EADDRINUSE: 98,
  ECONNABORTED: 103,
  ENETUNREACH: 101,
  ENETDOWN: 100,
  ETIMEDOUT: 110,
  EHOSTDOWN: 112,
  EHOSTUNREACH: 113,
  EINPROGRESS: 115,
  EALREADY: 114,
  EDESTADDRREQ: 89,
  EMSGSIZE: 90,
  EPROTONOSUPPORT: 93,
  ESOCKTNOSUPPORT: 94,
  EADDRNOTAVAIL: 99,
  ENETRESET: 102,
  EISCONN: 106,
  ENOTCONN: 107,
  ETOOMANYREFS: 109,
  EUSERS: 87,
  EDQUOT: 122,
  ESTALE: 116,
  ENOTSUP: 95,
  ENOMEDIUM: 123,
  EILSEQ: 84,
  EOVERFLOW: 75,
  ECANCELED: 125,
  ENOTRECOVERABLE: 131,
  EOWNERDEAD: 130,
  ESTRPIPE: 86
};
var ERRNO_MESSAGES = {
  0: "Success",
  1: "Not super-user",
  2: "No such file or directory",
  3: "No such process",
  4: "Interrupted system call",
  5: "I/O error",
  6: "No such device or address",
  7: "Arg list too long",
  8: "Exec format error",
  9: "Bad file number",
  10: "No children",
  11: "No more processes",
  12: "Not enough core",
  13: "Permission denied",
  14: "Bad address",
  15: "Block device required",
  16: "Mount device busy",
  17: "File exists",
  18: "Cross-device link",
  19: "No such device",
  20: "Not a directory",
  21: "Is a directory",
  22: "Invalid argument",
  23: "Too many open files in system",
  24: "Too many open files",
  25: "Not a typewriter",
  26: "Text file busy",
  27: "File too large",
  28: "No space left on device",
  29: "Illegal seek",
  30: "Read only file system",
  31: "Too many links",
  32: "Broken pipe",
  33: "Math arg out of domain of func",
  34: "Math result not representable",
  35: "File locking deadlock error",
  36: "File or path name too long",
  37: "No record locks available",
  38: "Function not implemented",
  39: "Directory not empty",
  40: "Too many symbolic links",
  42: "No message of desired type",
  43: "Identifier removed",
  44: "Channel number out of range",
  45: "Level 2 not synchronized",
  46: "Level 3 halted",
  47: "Level 3 reset",
  48: "Link number out of range",
  49: "Protocol driver not attached",
  50: "No CSI structure available",
  51: "Level 2 halted",
  52: "Invalid exchange",
  53: "Invalid request descriptor",
  54: "Exchange full",
  55: "No anode",
  56: "Invalid request code",
  57: "Invalid slot",
  59: "Bad font file fmt",
  60: "Device not a stream",
  61: "No data (for no delay io)",
  62: "Timer expired",
  63: "Out of streams resources",
  64: "Machine is not on the network",
  65: "Package not installed",
  66: "The object is remote",
  67: "The link has been severed",
  68: "Advertise error",
  69: "Srmount error",
  70: "Communication error on send",
  71: "Protocol error",
  72: "Multihop attempted",
  73: "Cross mount point (not really error)",
  74: "Trying to read unreadable message",
  75: "Value too large for defined data type",
  76: "Given log. name not unique",
  77: "f.d. invalid for this operation",
  78: "Remote address changed",
  79: "Can   access a needed shared lib",
  80: "Accessing a corrupted shared lib",
  81: ".lib section in a.out corrupted",
  82: "Attempting to link in too many libs",
  83: "Attempting to exec a shared library",
  84: "Illegal byte sequence",
  86: "Streams pipe error",
  87: "Too many users",
  88: "Socket operation on non-socket",
  89: "Destination address required",
  90: "Message too long",
  91: "Protocol wrong type for socket",
  92: "Protocol not available",
  93: "Unknown protocol",
  94: "Socket type not supported",
  95: "Not supported",
  96: "Protocol family not supported",
  97: "Address family not supported by protocol family",
  98: "Address already in use",
  99: "Address not available",
  100: "Network interface is not configured",
  101: "Network is unreachable",
  102: "Connection reset by network",
  103: "Connection aborted",
  104: "Connection reset by peer",
  105: "No buffer space available",
  106: "Socket is already connected",
  107: "Socket is not connected",
  108: "Can't send after socket shutdown",
  109: "Too many references",
  110: "Connection timed out",
  111: "Connection refused",
  112: "Host is down",
  113: "Host is unreachable",
  114: "Socket already connected",
  115: "Connection already in progress",
  116: "Stale file handle",
  122: "Quota exceeded",
  123: "No medium (in tape drive)",
  125: "Operation canceled",
  130: "Previous owner died",
  131: "State not recoverable"
};
var ___errno_state = 0;

function ___setErrNo(value) {
  HEAP32[___errno_state >> 2] = value;
  return value
}

function _strerror_r(errnum, strerrbuf, buflen) {
  if (errnum in ERRNO_MESSAGES) {
    if (ERRNO_MESSAGES[errnum].length > buflen - 1) {
      return ___setErrNo(ERRNO_CODES.ERANGE)
    } else {
      var msg = ERRNO_MESSAGES[errnum];
      writeAsciiToMemory(msg, strerrbuf);
      return 0
    }
  } else {
    return ___setErrNo(ERRNO_CODES.EINVAL)
  }
}

function _strerror(errnum) {
  if (!_strerror.buffer) _strerror.buffer = _malloc(256);
  _strerror_r(errnum, _strerror.buffer, 256);
  return _strerror.buffer
}
Module["_i64Subtract"] = _i64Subtract;
Module["_i64Add"] = _i64Add;

function __ZSt18uncaught_exceptionv() {
  return !!__ZSt18uncaught_exceptionv.uncaught_exception
}
var EXCEPTIONS = {
  last: 0,
  caught: [],
  infos: {},
  deAdjust: (function(adjusted) {
    if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
    for (var ptr in EXCEPTIONS.infos) {
      var info = EXCEPTIONS.infos[ptr];
      if (info.adjusted === adjusted) {
        return ptr
      }
    }
    return adjusted
  }),
  addRef: (function(ptr) {
    if (!ptr) return;
    var info = EXCEPTIONS.infos[ptr];
    info.refcount++
  }),
  decRef: (function(ptr) {
    if (!ptr) return;
    var info = EXCEPTIONS.infos[ptr];
    assert(info.refcount > 0);
    info.refcount--;
    if (info.refcount === 0) {
      if (info.destructor) {
        Runtime.dynCall("vi", info.destructor, [ptr])
      }
      delete EXCEPTIONS.infos[ptr];
      ___cxa_free_exception(ptr)
    }
  }),
  clearRef: (function(ptr) {
    if (!ptr) return;
    var info = EXCEPTIONS.infos[ptr];
    info.refcount = 0
  })
};

function ___resumeException(ptr) {
  if (!EXCEPTIONS.last) {
    EXCEPTIONS.last = ptr
  }
  EXCEPTIONS.clearRef(EXCEPTIONS.deAdjust(ptr));
  throw ptr
}

function ___cxa_find_matching_catch() {
  var thrown = EXCEPTIONS.last;
  if (!thrown) {
    return (asm["setTempRet0"](0), 0) | 0
  }
  var info = EXCEPTIONS.infos[thrown];
  var throwntype = info.type;
  if (!throwntype) {
    return (asm["setTempRet0"](0), thrown) | 0
  }
  var typeArray = Array.prototype.slice.call(arguments);
  var pointer = Module["___cxa_is_pointer_type"](throwntype);
  if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
  HEAP32[___cxa_find_matching_catch.buffer >> 2] = thrown;
  thrown = ___cxa_find_matching_catch.buffer;
  for (var i = 0; i < typeArray.length; i++) {
    if (typeArray[i] && Module["___cxa_can_catch"](typeArray[i], throwntype, thrown)) {
      thrown = HEAP32[thrown >> 2];
      info.adjusted = thrown;
      return (asm["setTempRet0"](typeArray[i]), thrown) | 0
    }
  }
  thrown = HEAP32[thrown >> 2];
  return (asm["setTempRet0"](throwntype), thrown) | 0
}

function ___cxa_throw(ptr, type, destructor) {
  EXCEPTIONS.infos[ptr] = {
    ptr: ptr,
    adjusted: ptr,
    type: type,
    destructor: destructor,
    refcount: 0
  };
  EXCEPTIONS.last = ptr;
  if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
    __ZSt18uncaught_exceptionv.uncaught_exception = 1
  } else {
    __ZSt18uncaught_exceptionv.uncaught_exception++
  }
  throw ptr
}
var PATH = {
  splitPath: (function(filename) {
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    return splitPathRe.exec(filename).slice(1)
  }),
  normalizeArray: (function(parts, allowAboveRoot) {
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === ".") {
        parts.splice(i, 1)
      } else if (last === "..") {
        parts.splice(i, 1);
        up++
      } else if (up) {
        parts.splice(i, 1);
        up--
      }
    }
    if (allowAboveRoot) {
      for (; up--; up) {
        parts.unshift("..")
      }
    }
    return parts
  }),
  normalize: (function(path) {
    var isAbsolute = path.charAt(0) === "/",
      trailingSlash = path.substr(-1) === "/";
    path = PATH.normalizeArray(path.split("/").filter((function(p) {
      return !!p
    })), !isAbsolute).join("/");
    if (!path && !isAbsolute) {
      path = "."
    }
    if (path && trailingSlash) {
      path += "/"
    }
    return (isAbsolute ? "/" : "") + path
  }),
  dirname: (function(path) {
    var result = PATH.splitPath(path),
      root = result[0],
      dir = result[1];
    if (!root && !dir) {
      return "."
    }
    if (dir) {
      dir = dir.substr(0, dir.length - 1)
    }
    return root + dir
  }),
  basename: (function(path) {
    if (path === "/") return "/";
    var lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) return path;
    return path.substr(lastSlash + 1)
  }),
  extname: (function(path) {
    return PATH.splitPath(path)[3]
  }),
  join: (function() {
    var paths = Array.prototype.slice.call(arguments, 0);
    return PATH.normalize(paths.join("/"))
  }),
  join2: (function(l, r) {
    return PATH.normalize(l + "/" + r)
  }),
  resolve: (function() {
    var resolvedPath = "",
      resolvedAbsolute = false;
    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = i >= 0 ? arguments[i] : FS.cwd();
      if (typeof path !== "string") {
        throw new TypeError("Arguments to path.resolve must be strings")
      } else if (!path) {
        return ""
      }
      resolvedPath = path + "/" + resolvedPath;
      resolvedAbsolute = path.charAt(0) === "/"
    }
    resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter((function(p) {
      return !!p
    })), !resolvedAbsolute).join("/");
    return (resolvedAbsolute ? "/" : "") + resolvedPath || "."
  }),
  relative: (function(from, to) {
    from = PATH.resolve(from).substr(1);
    to = PATH.resolve(to).substr(1);

    function trim(arr) {
      var start = 0;
      for (; start < arr.length; start++) {
        if (arr[start] !== "") break
      }
      var end = arr.length - 1;
      for (; end >= 0; end--) {
        if (arr[end] !== "") break
      }
      if (start > end) return [];
      return arr.slice(start, end - start + 1)
    }
    var fromParts = trim(from.split("/"));
    var toParts = trim(to.split("/"));
    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break
      }
    }
    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push("..")
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength));
    return outputParts.join("/")
  })
};
var TTY = {
  ttys: [],
  init: (function() {}),
  shutdown: (function() {}),
  register: (function(dev, ops) {
    TTY.ttys[dev] = {
      input: [],
      output: [],
      ops: ops
    };
    FS.registerDevice(dev, TTY.stream_ops)
  }),
  stream_ops: {
    open: (function(stream) {
      var tty = TTY.ttys[stream.node.rdev];
      if (!tty) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
      }
      stream.tty = tty;
      stream.seekable = false
    }),
    close: (function(stream) {
      stream.tty.ops.flush(stream.tty)
    }),
    flush: (function(stream) {
      stream.tty.ops.flush(stream.tty)
    }),
    read: (function(stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.get_char) {
        throw new FS.ErrnoError(ERRNO_CODES.ENXIO)
      }
      var bytesRead = 0;
      for (var i = 0; i < length; i++) {
        var result;
        try {
          result = stream.tty.ops.get_char(stream.tty)
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES.EIO)
        }
        if (result === undefined && bytesRead === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
        }
        if (result === null || result === undefined) break;
        bytesRead++;
        buffer[offset + i] = result
      }
      if (bytesRead) {
        stream.node.timestamp = Date.now()
      }
      return bytesRead
    }),
    write: (function(stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.put_char) {
        throw new FS.ErrnoError(ERRNO_CODES.ENXIO)
      }
      for (var i = 0; i < length; i++) {
        try {
          stream.tty.ops.put_char(stream.tty, buffer[offset + i])
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES.EIO)
        }
      }
      if (length) {
        stream.node.timestamp = Date.now()
      }
      return i
    })
  },
  default_tty_ops: {
    get_char: (function(tty) {
      if (!tty.input.length) {
        var result = null;
        if (ENVIRONMENT_IS_NODE) {
          var BUFSIZE = 256;
          var buf = new Buffer(BUFSIZE);
          var bytesRead = 0;
          var fd = process.stdin.fd;
          var usingDevice = false;
          try {
            fd = fs.openSync("/dev/stdin", "r");
            usingDevice = true
          } catch (e) {}
          bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
          if (usingDevice) {
            fs.closeSync(fd)
          }
          if (bytesRead > 0) {
            result = buf.slice(0, bytesRead).toString("utf-8")
          } else {
            result = null
          }
        } else if (typeof window != "undefined" && typeof window.prompt == "function") {
          result = window.prompt("Input: ");
          if (result !== null) {
            result += "\n"
          }
        } else if (typeof readline == "function") {
          result = readline();
          if (result !== null) {
            result += "\n"
          }
        }
        if (!result) {
          return null
        }
        tty.input = intArrayFromString(result, true)
      }
      return tty.input.shift()
    }),
    put_char: (function(tty, val) {
      if (val === null || val === 10) {
        Module["print"](UTF8ArrayToString(tty.output, 0));
        tty.output = []
      } else {
        if (val != 0) tty.output.push(val)
      }
    }),
    flush: (function(tty) {
      if (tty.output && tty.output.length > 0) {
        Module["print"](UTF8ArrayToString(tty.output, 0));
        tty.output = []
      }
    })
  },
  default_tty1_ops: {
    put_char: (function(tty, val) {
      if (val === null || val === 10) {
        Module["printErr"](UTF8ArrayToString(tty.output, 0));
        tty.output = []
      } else {
        if (val != 0) tty.output.push(val)
      }
    }),
    flush: (function(tty) {
      if (tty.output && tty.output.length > 0) {
        Module["printErr"](UTF8ArrayToString(tty.output, 0));
        tty.output = []
      }
    })
  }
};
var MEMFS = {
  ops_table: null,
  mount: (function(mount) {
    return MEMFS.createNode(null, "/", 16384 | 511, 0)
  }),
  createNode: (function(parent, name, mode, dev) {
    if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM)
    }
    if (!MEMFS.ops_table) {
      MEMFS.ops_table = {
        dir: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
            lookup: MEMFS.node_ops.lookup,
            mknod: MEMFS.node_ops.mknod,
            rename: MEMFS.node_ops.rename,
            unlink: MEMFS.node_ops.unlink,
            rmdir: MEMFS.node_ops.rmdir,
            readdir: MEMFS.node_ops.readdir,
            symlink: MEMFS.node_ops.symlink
          },
          stream: {
            llseek: MEMFS.stream_ops.llseek
          }
        },
        file: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr
          },
          stream: {
            llseek: MEMFS.stream_ops.llseek,
            read: MEMFS.stream_ops.read,
            write: MEMFS.stream_ops.write,
            allocate: MEMFS.stream_ops.allocate,
            mmap: MEMFS.stream_ops.mmap,
            msync: MEMFS.stream_ops.msync
          }
        },
        link: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
            readlink: MEMFS.node_ops.readlink
          },
          stream: {}
        },
        chrdev: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr
          },
          stream: FS.chrdev_stream_ops
        }
      }
    }
    var node = FS.createNode(parent, name, mode, dev);
    if (FS.isDir(node.mode)) {
      node.node_ops = MEMFS.ops_table.dir.node;
      node.stream_ops = MEMFS.ops_table.dir.stream;
      node.contents = {}
    } else if (FS.isFile(node.mode)) {
      node.node_ops = MEMFS.ops_table.file.node;
      node.stream_ops = MEMFS.ops_table.file.stream;
      node.usedBytes = 0;
      node.contents = null
    } else if (FS.isLink(node.mode)) {
      node.node_ops = MEMFS.ops_table.link.node;
      node.stream_ops = MEMFS.ops_table.link.stream
    } else if (FS.isChrdev(node.mode)) {
      node.node_ops = MEMFS.ops_table.chrdev.node;
      node.stream_ops = MEMFS.ops_table.chrdev.stream
    }
    node.timestamp = Date.now();
    if (parent) {
      parent.contents[name] = node
    }
    return node
  }),
  getFileDataAsRegularArray: (function(node) {
    if (node.contents && node.contents.subarray) {
      var arr = [];
      for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
      return arr
    }
    return node.contents
  }),
  getFileDataAsTypedArray: (function(node) {
    if (!node.contents) return new Uint8Array;
    if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
    return new Uint8Array(node.contents)
  }),
  expandFileStorage: (function(node, newCapacity) {
    if (node.contents && node.contents.subarray && newCapacity > node.contents.length) {
      node.contents = MEMFS.getFileDataAsRegularArray(node);
      node.usedBytes = node.contents.length
    }
    if (!node.contents || node.contents.subarray) {
      var prevCapacity = node.contents ? node.contents.buffer.byteLength : 0;
      if (prevCapacity >= newCapacity) return;
      var CAPACITY_DOUBLING_MAX = 1024 * 1024;
      newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) | 0);
      if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
      var oldContents = node.contents;
      node.contents = new Uint8Array(newCapacity);
      if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
      return
    }
    if (!node.contents && newCapacity > 0) node.contents = [];
    while (node.contents.length < newCapacity) node.contents.push(0)
  }),
  resizeFileStorage: (function(node, newSize) {
    if (node.usedBytes == newSize) return;
    if (newSize == 0) {
      node.contents = null;
      node.usedBytes = 0;
      return
    }
    if (!node.contents || node.contents.subarray) {
      var oldContents = node.contents;
      node.contents = new Uint8Array(new ArrayBuffer(newSize));
      if (oldContents) {
        node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)))
      }
      node.usedBytes = newSize;
      return
    }
    if (!node.contents) node.contents = [];
    if (node.contents.length > newSize) node.contents.length = newSize;
    else
      while (node.contents.length < newSize) node.contents.push(0);
    node.usedBytes = newSize
  }),
  node_ops: {
    getattr: (function(node) {
      var attr = {};
      attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
      attr.ino = node.id;
      attr.mode = node.mode;
      attr.nlink = 1;
      attr.uid = 0;
      attr.gid = 0;
      attr.rdev = node.rdev;
      if (FS.isDir(node.mode)) {
        attr.size = 4096
      } else if (FS.isFile(node.mode)) {
        attr.size = node.usedBytes
      } else if (FS.isLink(node.mode)) {
        attr.size = node.link.length
      } else {
        attr.size = 0
      }
      attr.atime = new Date(node.timestamp);
      attr.mtime = new Date(node.timestamp);
      attr.ctime = new Date(node.timestamp);
      attr.blksize = 4096;
      attr.blocks = Math.ceil(attr.size / attr.blksize);
      return attr
    }),
    setattr: (function(node, attr) {
      if (attr.mode !== undefined) {
        node.mode = attr.mode
      }
      if (attr.timestamp !== undefined) {
        node.timestamp = attr.timestamp
      }
      if (attr.size !== undefined) {
        MEMFS.resizeFileStorage(node, attr.size)
      }
    }),
    lookup: (function(parent, name) {
      throw FS.genericErrors[ERRNO_CODES.ENOENT]
    }),
    mknod: (function(parent, name, mode, dev) {
      return MEMFS.createNode(parent, name, mode, dev)
    }),
    rename: (function(old_node, new_dir, new_name) {
      if (FS.isDir(old_node.mode)) {
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name)
        } catch (e) {}
        if (new_node) {
          for (var i in new_node.contents) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
          }
        }
      }
      delete old_node.parent.contents[old_node.name];
      old_node.name = new_name;
      new_dir.contents[new_name] = old_node;
      old_node.parent = new_dir
    }),
    unlink: (function(parent, name) {
      delete parent.contents[name]
    }),
    rmdir: (function(parent, name) {
      var node = FS.lookupNode(parent, name);
      for (var i in node.contents) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
      }
      delete parent.contents[name]
    }),
    readdir: (function(node) {
      var entries = [".", ".."];
      for (var key in node.contents) {
        if (!node.contents.hasOwnProperty(key)) {
          continue
        }
        entries.push(key)
      }
      return entries
    }),
    symlink: (function(parent, newname, oldpath) {
      var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
      node.link = oldpath;
      return node
    }),
    readlink: (function(node) {
      if (!FS.isLink(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      return node.link
    })
  },
  stream_ops: {
    read: (function(stream, buffer, offset, length, position) {
      var contents = stream.node.contents;
      if (position >= stream.node.usedBytes) return 0;
      var size = Math.min(stream.node.usedBytes - position, length);
      assert(size >= 0);
      if (size > 8 && contents.subarray) {
        buffer.set(contents.subarray(position, position + size), offset)
      } else {
        for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i]
      }
      return size
    }),
    write: (function(stream, buffer, offset, length, position, canOwn) {
      if (!length) return 0;
      var node = stream.node;
      node.timestamp = Date.now();
      if (buffer.subarray && (!node.contents || node.contents.subarray)) {
        if (canOwn) {
          node.contents = buffer.subarray(offset, offset + length);
          node.usedBytes = length;
          return length
        } else if (node.usedBytes === 0 && position === 0) {
          node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
          node.usedBytes = length;
          return length
        } else if (position + length <= node.usedBytes) {
          node.contents.set(buffer.subarray(offset, offset + length), position);
          return length
        }
      }
      MEMFS.expandFileStorage(node, position + length);
      if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position);
      else {
        for (var i = 0; i < length; i++) {
          node.contents[position + i] = buffer[offset + i]
        }
      }
      node.usedBytes = Math.max(node.usedBytes, position + length);
      return length
    }),
    llseek: (function(stream, offset, whence) {
      var position = offset;
      if (whence === 1) {
        position += stream.position
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          position += stream.node.usedBytes
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      return position
    }),
    allocate: (function(stream, offset, length) {
      MEMFS.expandFileStorage(stream.node, offset + length);
      stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length)
    }),
    mmap: (function(stream, buffer, offset, length, position, prot, flags) {
      if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
      }
      var ptr;
      var allocated;
      var contents = stream.node.contents;
      if (!(flags & 2) && (contents.buffer === buffer || contents.buffer === buffer.buffer)) {
        allocated = false;
        ptr = contents.byteOffset
      } else {
        if (position > 0 || position + length < stream.node.usedBytes) {
          if (contents.subarray) {
            contents = contents.subarray(position, position + length)
          } else {
            contents = Array.prototype.slice.call(contents, position, position + length)
          }
        }
        allocated = true;
        ptr = _malloc(length);
        if (!ptr) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOMEM)
        }
        buffer.set(contents, ptr)
      }
      return {
        ptr: ptr,
        allocated: allocated
      }
    }),
    msync: (function(stream, buffer, offset, length, mmapFlags) {
      if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
      }
      if (mmapFlags & 2) {
        return 0
      }
      var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
      return 0
    })
  }
};
var IDBFS = {
  dbs: {},
  indexedDB: (function() {
    if (typeof indexedDB !== "undefined") return indexedDB;
    var ret = null;
    if (typeof window === "object") ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    assert(ret, "IDBFS used, but indexedDB not supported");
    return ret
  }),
  DB_VERSION: 21,
  DB_STORE_NAME: "FILE_DATA",
  mount: (function(mount) {
    return MEMFS.mount.apply(null, arguments)
  }),
  syncfs: (function(mount, populate, callback) {
    IDBFS.getLocalSet(mount, (function(err, local) {
      if (err) return callback(err);
      IDBFS.getRemoteSet(mount, (function(err, remote) {
        if (err) return callback(err);
        var src = populate ? remote : local;
        var dst = populate ? local : remote;
        IDBFS.reconcile(src, dst, callback)
      }))
    }))
  }),
  getDB: (function(name, callback) {
    var db = IDBFS.dbs[name];
    if (db) {
      return callback(null, db)
    }
    var req;
    try {
      req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION)
    } catch (e) {
      return callback(e)
    }
    req.onupgradeneeded = (function(e) {
      var db = e.target.result;
      var transaction = e.target.transaction;
      var fileStore;
      if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
        fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME)
      } else {
        fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME)
      }
      if (!fileStore.indexNames.contains("timestamp")) {
        fileStore.createIndex("timestamp", "timestamp", {
          unique: false
        })
      }
    });
    req.onsuccess = (function() {
      db = req.result;
      IDBFS.dbs[name] = db;
      callback(null, db)
    });
    req.onerror = (function(e) {
      callback(this.error);
      e.preventDefault()
    })
  }),
  getLocalSet: (function(mount, callback) {
    var entries = {};

    function isRealDir(p) {
      return p !== "." && p !== ".."
    }

    function toAbsolute(root) {
      return (function(p) {
        return PATH.join2(root, p)
      })
    }
    var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
    while (check.length) {
      var path = check.pop();
      var stat;
      try {
        stat = FS.stat(path)
      } catch (e) {
        return callback(e)
      }
      if (FS.isDir(stat.mode)) {
        check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)))
      }
      entries[path] = {
        timestamp: stat.mtime
      }
    }
    return callback(null, {
      type: "local",
      entries: entries
    })
  }),
  getRemoteSet: (function(mount, callback) {
    var entries = {};
    IDBFS.getDB(mount.mountpoint, (function(err, db) {
      if (err) return callback(err);
      var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readonly");
      transaction.onerror = (function(e) {
        callback(this.error);
        e.preventDefault()
      });
      var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
      var index = store.index("timestamp");
      index.openKeyCursor().onsuccess = (function(event) {
        var cursor = event.target.result;
        if (!cursor) {
          return callback(null, {
            type: "remote",
            db: db,
            entries: entries
          })
        }
        entries[cursor.primaryKey] = {
          timestamp: cursor.key
        };
        cursor.continue()
      })
    }))
  }),
  loadLocalEntry: (function(path, callback) {
    var stat, node;
    try {
      var lookup = FS.lookupPath(path);
      node = lookup.node;
      stat = FS.stat(path)
    } catch (e) {
      return callback(e)
    }
    if (FS.isDir(stat.mode)) {
      return callback(null, {
        timestamp: stat.mtime,
        mode: stat.mode
      })
    } else if (FS.isFile(stat.mode)) {
      node.contents = MEMFS.getFileDataAsTypedArray(node);
      return callback(null, {
        timestamp: stat.mtime,
        mode: stat.mode,
        contents: node.contents
      })
    } else {
      return callback(new Error("node type not supported"))
    }
  }),
  storeLocalEntry: (function(path, entry, callback) {
    try {
      if (FS.isDir(entry.mode)) {
        FS.mkdir(path, entry.mode)
      } else if (FS.isFile(entry.mode)) {
        FS.writeFile(path, entry.contents, {
          encoding: "binary",
          canOwn: true
        })
      } else {
        return callback(new Error("node type not supported"))
      }
      FS.chmod(path, entry.mode);
      FS.utime(path, entry.timestamp, entry.timestamp)
    } catch (e) {
      return callback(e)
    }
    callback(null)
  }),
  removeLocalEntry: (function(path, callback) {
    try {
      var lookup = FS.lookupPath(path);
      var stat = FS.stat(path);
      if (FS.isDir(stat.mode)) {
        FS.rmdir(path)
      } else if (FS.isFile(stat.mode)) {
        FS.unlink(path)
      }
    } catch (e) {
      return callback(e)
    }
    callback(null)
  }),
  loadRemoteEntry: (function(store, path, callback) {
    var req = store.get(path);
    req.onsuccess = (function(event) {
      callback(null, event.target.result)
    });
    req.onerror = (function(e) {
      callback(this.error);
      e.preventDefault()
    })
  }),
  storeRemoteEntry: (function(store, path, entry, callback) {
    var req = store.put(entry, path);
    req.onsuccess = (function() {
      callback(null)
    });
    req.onerror = (function(e) {
      callback(this.error);
      e.preventDefault()
    })
  }),
  removeRemoteEntry: (function(store, path, callback) {
    var req = store.delete(path);
    req.onsuccess = (function() {
      callback(null)
    });
    req.onerror = (function(e) {
      callback(this.error);
      e.preventDefault()
    })
  }),
  reconcile: (function(src, dst, callback) {
    var total = 0;
    var create = [];
    Object.keys(src.entries).forEach((function(key) {
      var e = src.entries[key];
      var e2 = dst.entries[key];
      if (!e2 || e.timestamp > e2.timestamp) {
        create.push(key);
        total++
      }
    }));
    var remove = [];
    Object.keys(dst.entries).forEach((function(key) {
      var e = dst.entries[key];
      var e2 = src.entries[key];
      if (!e2) {
        remove.push(key);
        total++
      }
    }));
    if (!total) {
      return callback(null)
    }
    var errored = false;
    var completed = 0;
    var db = src.type === "remote" ? src.db : dst.db;
    var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readwrite");
    var store = transaction.objectStore(IDBFS.DB_STORE_NAME);

    function done(err) {
      if (err) {
        if (!done.errored) {
          done.errored = true;
          return callback(err)
        }
        return
      }
      if (++completed >= total) {
        return callback(null)
      }
    }
    transaction.onerror = (function(e) {
      done(this.error);
      e.preventDefault()
    });
    create.sort().forEach((function(path) {
      if (dst.type === "local") {
        IDBFS.loadRemoteEntry(store, path, (function(err, entry) {
          if (err) return done(err);
          IDBFS.storeLocalEntry(path, entry, done)
        }))
      } else {
        IDBFS.loadLocalEntry(path, (function(err, entry) {
          if (err) return done(err);
          IDBFS.storeRemoteEntry(store, path, entry, done)
        }))
      }
    }));
    remove.sort().reverse().forEach((function(path) {
      if (dst.type === "local") {
        IDBFS.removeLocalEntry(path, done)
      } else {
        IDBFS.removeRemoteEntry(store, path, done)
      }
    }))
  })
};
var NODEFS = {
  isWindows: false,
  staticInit: (function() {
    NODEFS.isWindows = !!process.platform.match(/^win/)
  }),
  mount: (function(mount) {
    assert(ENVIRONMENT_IS_NODE);
    return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0)
  }),
  createNode: (function(parent, name, mode, dev) {
    if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
    }
    var node = FS.createNode(parent, name, mode);
    node.node_ops = NODEFS.node_ops;
    node.stream_ops = NODEFS.stream_ops;
    return node
  }),
  getMode: (function(path) {
    var stat;
    try {
      stat = fs.lstatSync(path);
      if (NODEFS.isWindows) {
        stat.mode = stat.mode | (stat.mode & 146) >> 1
      }
    } catch (e) {
      if (!e.code) throw e;
      throw new FS.ErrnoError(ERRNO_CODES[e.code])
    }
    return stat.mode
  }),
  realPath: (function(node) {
    var parts = [];
    while (node.parent !== node) {
      parts.push(node.name);
      node = node.parent
    }
    parts.push(node.mount.opts.root);
    parts.reverse();
    return PATH.join.apply(null, parts)
  }),
  flagsToPermissionStringMap: {
    0: "r",
    1: "r+",
    2: "r+",
    64: "r",
    65: "r+",
    66: "r+",
    129: "rx+",
    193: "rx+",
    514: "w+",
    577: "w",
    578: "w+",
    705: "wx",
    706: "wx+",
    1024: "a",
    1025: "a",
    1026: "a+",
    1089: "a",
    1090: "a+",
    1153: "ax",
    1154: "ax+",
    1217: "ax",
    1218: "ax+",
    4096: "rs",
    4098: "rs+"
  },
  flagsToPermissionString: (function(flags) {
    if (flags in NODEFS.flagsToPermissionStringMap) {
      return NODEFS.flagsToPermissionStringMap[flags]
    } else {
      return flags
    }
  }),
  node_ops: {
    getattr: (function(node) {
      var path = NODEFS.realPath(node);
      var stat;
      try {
        stat = fs.lstatSync(path)
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code])
      }
      if (NODEFS.isWindows && !stat.blksize) {
        stat.blksize = 4096
      }
      if (NODEFS.isWindows && !stat.blocks) {
        stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0
      }
      return {
        dev: stat.dev,
        ino: stat.ino,
        mode: stat.mode,
        nlink: stat.nlink,
        uid: stat.uid,
        gid: stat.gid,
        rdev: stat.rdev,
        size: stat.size,
        atime: stat.atime,
        mtime: stat.mtime,
        ctime: stat.ctime,
        blksize: stat.blksize,
        blocks: stat.blocks
      }
    }),
    setattr: (function(node, attr) {
      var path = NODEFS.realPath(node);
      try {
        if (attr.mode !== undefined) {
          fs.chmodSync(path, attr.mode);
          node.mode = attr.mode
        }
        if (attr.timestamp !== undefined) {
          var date = new Date(attr.timestamp);
          fs.utimesSync(path, date, date)
        }
        if (attr.size !== undefined) {
          fs.truncateSync(path, attr.size)
        }
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code])
      }
    }),
    lookup: (function(parent, name) {
      var path = PATH.join2(NODEFS.realPath(parent), name);
      var mode = NODEFS.getMode(path);
      return NODEFS.createNode(parent, name, mode)
    }),
    mknod: (function(parent, name, mode, dev) {
      var node = NODEFS.createNode(parent, name, mode, dev);
      var path = NODEFS.realPath(node);
      try {
        if (FS.isDir(node.mode)) {
          fs.mkdirSync(path, node.mode)
        } else {
          fs.writeFileSync(path, "", {
            mode: node.mode
          })
        }
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code])
      }
      return node
    }),
    rename: (function(oldNode, newDir, newName) {
      var oldPath = NODEFS.realPath(oldNode);
      var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
      try {
        fs.renameSync(oldPath, newPath)
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code])
      }
    }),
    unlink: (function(parent, name) {
      var path = PATH.join2(NODEFS.realPath(parent), name);
      try {
        fs.unlinkSync(path)
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code])
      }
    }),
    rmdir: (function(parent, name) {
      var path = PATH.join2(NODEFS.realPath(parent), name);
      try {
        fs.rmdirSync(path)
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code])
      }
    }),
    readdir: (function(node) {
      var path = NODEFS.realPath(node);
      try {
        return fs.readdirSync(path)
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code])
      }
    }),
    symlink: (function(parent, newName, oldPath) {
      var newPath = PATH.join2(NODEFS.realPath(parent), newName);
      try {
        fs.symlinkSync(oldPath, newPath)
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code])
      }
    }),
    readlink: (function(node) {
      var path = NODEFS.realPath(node);
      try {
        path = fs.readlinkSync(path);
        path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
        return path
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code])
      }
    })
  },
  stream_ops: {
    open: (function(stream) {
      var path = NODEFS.realPath(stream.node);
      try {
        if (FS.isFile(stream.node.mode)) {
          stream.nfd = fs.openSync(path, NODEFS.flagsToPermissionString(stream.flags))
        }
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code])
      }
    }),
    close: (function(stream) {
      try {
        if (FS.isFile(stream.node.mode) && stream.nfd) {
          fs.closeSync(stream.nfd)
        }
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code])
      }
    }),
    read: (function(stream, buffer, offset, length, position) {
      if (length === 0) return 0;
      var nbuffer = new Buffer(length);
      var res;
      try {
        res = fs.readSync(stream.nfd, nbuffer, 0, length, position)
      } catch (e) {
        throw new FS.ErrnoError(ERRNO_CODES[e.code])
      }
      if (res > 0) {
        for (var i = 0; i < res; i++) {
          buffer[offset + i] = nbuffer[i]
        }
      }
      return res
    }),
    write: (function(stream, buffer, offset, length, position) {
      var nbuffer = new Buffer(buffer.subarray(offset, offset + length));
      var res;
      try {
        res = fs.writeSync(stream.nfd, nbuffer, 0, length, position)
      } catch (e) {
        throw new FS.ErrnoError(ERRNO_CODES[e.code])
      }
      return res
    }),
    llseek: (function(stream, offset, whence) {
      var position = offset;
      if (whence === 1) {
        position += stream.position
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          try {
            var stat = fs.fstatSync(stream.nfd);
            position += stat.size
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code])
          }
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      return position
    })
  }
};
var _stdin = allocate(1, "i32*", ALLOC_STATIC);
var _stdout = allocate(1, "i32*", ALLOC_STATIC);
var _stderr = allocate(1, "i32*", ALLOC_STATIC);

function _fflush(stream) {}
var FS = {
  root: null,
  mounts: [],
  devices: [null],
  streams: [],
  nextInode: 1,
  nameTable: null,
  currentPath: "/",
  initialized: false,
  ignorePermissions: true,
  trackingDelegate: {},
  tracking: {
    openFlags: {
      READ: 1,
      WRITE: 2
    }
  },
  ErrnoError: null,
  genericErrors: {},
  handleFSError: (function(e) {
    if (!(e instanceof FS.ErrnoError)) throw e + " : " + stackTrace();
    return ___setErrNo(e.errno)
  }),
  lookupPath: (function(path, opts) {
    path = PATH.resolve(FS.cwd(), path);
    opts = opts || {};
    if (!path) return {
      path: "",
      node: null
    };
    var defaults = {
      follow_mount: true,
      recurse_count: 0
    };
    for (var key in defaults) {
      if (opts[key] === undefined) {
        opts[key] = defaults[key]
      }
    }
    if (opts.recurse_count > 8) {
      throw new FS.ErrnoError(ERRNO_CODES.ELOOP)
    }
    var parts = PATH.normalizeArray(path.split("/").filter((function(p) {
      return !!p
    })), false);
    var current = FS.root;
    var current_path = "/";
    for (var i = 0; i < parts.length; i++) {
      var islast = i === parts.length - 1;
      if (islast && opts.parent) {
        break
      }
      current = FS.lookupNode(current, parts[i]);
      current_path = PATH.join2(current_path, parts[i]);
      if (FS.isMountpoint(current)) {
        if (!islast || islast && opts.follow_mount) {
          current = current.mounted.root
        }
      }
      if (!islast || opts.follow) {
        var count = 0;
        while (FS.isLink(current.mode)) {
          var link = FS.readlink(current_path);
          current_path = PATH.resolve(PATH.dirname(current_path), link);
          var lookup = FS.lookupPath(current_path, {
            recurse_count: opts.recurse_count
          });
          current = lookup.node;
          if (count++ > 40) {
            throw new FS.ErrnoError(ERRNO_CODES.ELOOP)
          }
        }
      }
    }
    return {
      path: current_path,
      node: current
    }
  }),
  getPath: (function(node) {
    var path;
    while (true) {
      if (FS.isRoot(node)) {
        var mount = node.mount.mountpoint;
        if (!path) return mount;
        return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path
      }
      path = path ? node.name + "/" + path : node.name;
      node = node.parent
    }
  }),
  hashName: (function(parentid, name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i) | 0
    }
    return (parentid + hash >>> 0) % FS.nameTable.length
  }),
  hashAddNode: (function(node) {
    var hash = FS.hashName(node.parent.id, node.name);
    node.name_next = FS.nameTable[hash];
    FS.nameTable[hash] = node
  }),
  hashRemoveNode: (function(node) {
    var hash = FS.hashName(node.parent.id, node.name);
    if (FS.nameTable[hash] === node) {
      FS.nameTable[hash] = node.name_next
    } else {
      var current = FS.nameTable[hash];
      while (current) {
        if (current.name_next === node) {
          current.name_next = node.name_next;
          break
        }
        current = current.name_next
      }
    }
  }),
  lookupNode: (function(parent, name) {
    var err = FS.mayLookup(parent);
    if (err) {
      throw new FS.ErrnoError(err, parent)
    }
    var hash = FS.hashName(parent.id, name);
    for (var node = FS.nameTable[hash]; node; node = node.name_next) {
      var nodeName = node.name;
      if (node.parent.id === parent.id && nodeName === name) {
        return node
      }
    }
    return FS.lookup(parent, name)
  }),
  createNode: (function(parent, name, mode, rdev) {
    if (!FS.FSNode) {
      FS.FSNode = (function(parent, name, mode, rdev) {
        if (!parent) {
          parent = this
        }
        this.parent = parent;
        this.mount = parent.mount;
        this.mounted = null;
        this.id = FS.nextInode++;
        this.name = name;
        this.mode = mode;
        this.node_ops = {};
        this.stream_ops = {};
        this.rdev = rdev
      });
      FS.FSNode.prototype = {};
      var readMode = 292 | 73;
      var writeMode = 146;
      Object.defineProperties(FS.FSNode.prototype, {
        read: {
          get: (function() {
            return (this.mode & readMode) === readMode
          }),
          set: (function(val) {
            val ? this.mode |= readMode : this.mode &= ~readMode
          })
        },
        write: {
          get: (function() {
            return (this.mode & writeMode) === writeMode
          }),
          set: (function(val) {
            val ? this.mode |= writeMode : this.mode &= ~writeMode
          })
        },
        isFolder: {
          get: (function() {
            return FS.isDir(this.mode)
          })
        },
        isDevice: {
          get: (function() {
            return FS.isChrdev(this.mode)
          })
        }
      })
    }
    var node = new FS.FSNode(parent, name, mode, rdev);
    FS.hashAddNode(node);
    return node
  }),
  destroyNode: (function(node) {
    FS.hashRemoveNode(node)
  }),
  isRoot: (function(node) {
    return node === node.parent
  }),
  isMountpoint: (function(node) {
    return !!node.mounted
  }),
  isFile: (function(mode) {
    return (mode & 61440) === 32768
  }),
  isDir: (function(mode) {
    return (mode & 61440) === 16384
  }),
  isLink: (function(mode) {
    return (mode & 61440) === 40960
  }),
  isChrdev: (function(mode) {
    return (mode & 61440) === 8192
  }),
  isBlkdev: (function(mode) {
    return (mode & 61440) === 24576
  }),
  isFIFO: (function(mode) {
    return (mode & 61440) === 4096
  }),
  isSocket: (function(mode) {
    return (mode & 49152) === 49152
  }),
  flagModes: {
    "r": 0,
    "rs": 1052672,
    "r+": 2,
    "w": 577,
    "wx": 705,
    "xw": 705,
    "w+": 578,
    "wx+": 706,
    "xw+": 706,
    "a": 1089,
    "ax": 1217,
    "xa": 1217,
    "a+": 1090,
    "ax+": 1218,
    "xa+": 1218
  },
  modeStringToFlags: (function(str) {
    var flags = FS.flagModes[str];
    if (typeof flags === "undefined") {
      throw new Error("Unknown file open mode: " + str)
    }
    return flags
  }),
  flagsToPermissionString: (function(flag) {
    var accmode = flag & 2097155;
    var perms = ["r", "w", "rw"][accmode];
    if (flag & 512) {
      perms += "w"
    }
    return perms
  }),
  nodePermissions: (function(node, perms) {
    if (FS.ignorePermissions) {
      return 0
    }
    if (perms.indexOf("r") !== -1 && !(node.mode & 292)) {
      return ERRNO_CODES.EACCES
    } else if (perms.indexOf("w") !== -1 && !(node.mode & 146)) {
      return ERRNO_CODES.EACCES
    } else if (perms.indexOf("x") !== -1 && !(node.mode & 73)) {
      return ERRNO_CODES.EACCES
    }
    return 0
  }),
  mayLookup: (function(dir) {
    var err = FS.nodePermissions(dir, "x");
    if (err) return err;
    if (!dir.node_ops.lookup) return ERRNO_CODES.EACCES;
    return 0
  }),
  mayCreate: (function(dir, name) {
    try {
      var node = FS.lookupNode(dir, name);
      return ERRNO_CODES.EEXIST
    } catch (e) {}
    return FS.nodePermissions(dir, "wx")
  }),
  mayDelete: (function(dir, name, isdir) {
    var node;
    try {
      node = FS.lookupNode(dir, name)
    } catch (e) {
      return e.errno
    }
    var err = FS.nodePermissions(dir, "wx");
    if (err) {
      return err
    }
    if (isdir) {
      if (!FS.isDir(node.mode)) {
        return ERRNO_CODES.ENOTDIR
      }
      if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
        return ERRNO_CODES.EBUSY
      }
    } else {
      if (FS.isDir(node.mode)) {
        return ERRNO_CODES.EISDIR
      }
    }
    return 0
  }),
  mayOpen: (function(node, flags) {
    if (!node) {
      return ERRNO_CODES.ENOENT
    }
    if (FS.isLink(node.mode)) {
      return ERRNO_CODES.ELOOP
    } else if (FS.isDir(node.mode)) {
      if ((flags & 2097155) !== 0 || flags & 512) {
        return ERRNO_CODES.EISDIR
      }
    }
    return FS.nodePermissions(node, FS.flagsToPermissionString(flags))
  }),
  MAX_OPEN_FDS: 4096,
  nextfd: (function(fd_start, fd_end) {
    fd_start = fd_start || 0;
    fd_end = fd_end || FS.MAX_OPEN_FDS;
    for (var fd = fd_start; fd <= fd_end; fd++) {
      if (!FS.streams[fd]) {
        return fd
      }
    }
    throw new FS.ErrnoError(ERRNO_CODES.EMFILE)
  }),
  getStream: (function(fd) {
    return FS.streams[fd]
  }),
  createStream: (function(stream, fd_start, fd_end) {
    if (!FS.FSStream) {
      FS.FSStream = (function() {});
      FS.FSStream.prototype = {};
      Object.defineProperties(FS.FSStream.prototype, {
        object: {
          get: (function() {
            return this.node
          }),
          set: (function(val) {
            this.node = val
          })
        },
        isRead: {
          get: (function() {
            return (this.flags & 2097155) !== 1
          })
        },
        isWrite: {
          get: (function() {
            return (this.flags & 2097155) !== 0
          })
        },
        isAppend: {
          get: (function() {
            return this.flags & 1024
          })
        }
      })
    }
    var newStream = new FS.FSStream;
    for (var p in stream) {
      newStream[p] = stream[p]
    }
    stream = newStream;
    var fd = FS.nextfd(fd_start, fd_end);
    stream.fd = fd;
    FS.streams[fd] = stream;
    return stream
  }),
  closeStream: (function(fd) {
    FS.streams[fd] = null
  }),
  getStreamFromPtr: (function(ptr) {
    return FS.streams[ptr - 1]
  }),
  getPtrForStream: (function(stream) {
    return stream ? stream.fd + 1 : 0
  }),
  chrdev_stream_ops: {
    open: (function(stream) {
      var device = FS.getDevice(stream.node.rdev);
      stream.stream_ops = device.stream_ops;
      if (stream.stream_ops.open) {
        stream.stream_ops.open(stream)
      }
    }),
    llseek: (function() {
      throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)
    })
  },
  major: (function(dev) {
    return dev >> 8
  }),
  minor: (function(dev) {
    return dev & 255
  }),
  makedev: (function(ma, mi) {
    return ma << 8 | mi
  }),
  registerDevice: (function(dev, ops) {
    FS.devices[dev] = {
      stream_ops: ops
    }
  }),
  getDevice: (function(dev) {
    return FS.devices[dev]
  }),
  getMounts: (function(mount) {
    var mounts = [];
    var check = [mount];
    while (check.length) {
      var m = check.pop();
      mounts.push(m);
      check.push.apply(check, m.mounts)
    }
    return mounts
  }),
  syncfs: (function(populate, callback) {
    if (typeof populate === "function") {
      callback = populate;
      populate = false
    }
    var mounts = FS.getMounts(FS.root.mount);
    var completed = 0;

    function done(err) {
      if (err) {
        if (!done.errored) {
          done.errored = true;
          return callback(err)
        }
        return
      }
      if (++completed >= mounts.length) {
        callback(null)
      }
    }
    mounts.forEach((function(mount) {
      if (!mount.type.syncfs) {
        return done(null)
      }
      mount.type.syncfs(mount, populate, done)
    }))
  }),
  mount: (function(type, opts, mountpoint) {
    var root = mountpoint === "/";
    var pseudo = !mountpoint;
    var node;
    if (root && FS.root) {
      throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
    } else if (!root && !pseudo) {
      var lookup = FS.lookupPath(mountpoint, {
        follow_mount: false
      });
      mountpoint = lookup.path;
      node = lookup.node;
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
      }
      if (!FS.isDir(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR)
      }
    }
    var mount = {
      type: type,
      opts: opts,
      mountpoint: mountpoint,
      mounts: []
    };
    var mountRoot = type.mount(mount);
    mountRoot.mount = mount;
    mount.root = mountRoot;
    if (root) {
      FS.root = mountRoot
    } else if (node) {
      node.mounted = mount;
      if (node.mount) {
        node.mount.mounts.push(mount)
      }
    }
    return mountRoot
  }),
  unmount: (function(mountpoint) {
    var lookup = FS.lookupPath(mountpoint, {
      follow_mount: false
    });
    if (!FS.isMountpoint(lookup.node)) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
    }
    var node = lookup.node;
    var mount = node.mounted;
    var mounts = FS.getMounts(mount);
    Object.keys(FS.nameTable).forEach((function(hash) {
      var current = FS.nameTable[hash];
      while (current) {
        var next = current.name_next;
        if (mounts.indexOf(current.mount) !== -1) {
          FS.destroyNode(current)
        }
        current = next
      }
    }));
    node.mounted = null;
    var idx = node.mount.mounts.indexOf(mount);
    assert(idx !== -1);
    node.mount.mounts.splice(idx, 1)
  }),
  lookup: (function(parent, name) {
    return parent.node_ops.lookup(parent, name)
  }),
  mknod: (function(path, mode, dev) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    var name = PATH.basename(path);
    if (!name || name === "." || name === "..") {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
    }
    var err = FS.mayCreate(parent, name);
    if (err) {
      throw new FS.ErrnoError(err)
    }
    if (!parent.node_ops.mknod) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM)
    }
    return parent.node_ops.mknod(parent, name, mode, dev)
  }),
  create: (function(path, mode) {
    mode = mode !== undefined ? mode : 438;
    mode &= 4095;
    mode |= 32768;
    return FS.mknod(path, mode, 0)
  }),
  mkdir: (function(path, mode) {
    mode = mode !== undefined ? mode : 511;
    mode &= 511 | 512;
    mode |= 16384;
    return FS.mknod(path, mode, 0)
  }),
  mkdev: (function(path, mode, dev) {
    if (typeof dev === "undefined") {
      dev = mode;
      mode = 438
    }
    mode |= 8192;
    return FS.mknod(path, mode, dev)
  }),
  symlink: (function(oldpath, newpath) {
    if (!PATH.resolve(oldpath)) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
    }
    var lookup = FS.lookupPath(newpath, {
      parent: true
    });
    var parent = lookup.node;
    if (!parent) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
    }
    var newname = PATH.basename(newpath);
    var err = FS.mayCreate(parent, newname);
    if (err) {
      throw new FS.ErrnoError(err)
    }
    if (!parent.node_ops.symlink) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM)
    }
    return parent.node_ops.symlink(parent, newname, oldpath)
  }),
  rename: (function(old_path, new_path) {
    var old_dirname = PATH.dirname(old_path);
    var new_dirname = PATH.dirname(new_path);
    var old_name = PATH.basename(old_path);
    var new_name = PATH.basename(new_path);
    var lookup, old_dir, new_dir;
    try {
      lookup = FS.lookupPath(old_path, {
        parent: true
      });
      old_dir = lookup.node;
      lookup = FS.lookupPath(new_path, {
        parent: true
      });
      new_dir = lookup.node
    } catch (e) {
      throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
    }
    if (!old_dir || !new_dir) throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
    if (old_dir.mount !== new_dir.mount) {
      throw new FS.ErrnoError(ERRNO_CODES.EXDEV)
    }
    var old_node = FS.lookupNode(old_dir, old_name);
    var relative = PATH.relative(old_path, new_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
    }
    relative = PATH.relative(new_path, old_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
    }
    var new_node;
    try {
      new_node = FS.lookupNode(new_dir, new_name)
    } catch (e) {}
    if (old_node === new_node) {
      return
    }
    var isdir = FS.isDir(old_node.mode);
    var err = FS.mayDelete(old_dir, old_name, isdir);
    if (err) {
      throw new FS.ErrnoError(err)
    }
    err = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
    if (err) {
      throw new FS.ErrnoError(err)
    }
    if (!old_dir.node_ops.rename) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM)
    }
    if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
      throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
    }
    if (new_dir !== old_dir) {
      err = FS.nodePermissions(old_dir, "w");
      if (err) {
        throw new FS.ErrnoError(err)
      }
    }
    try {
      if (FS.trackingDelegate["willMovePath"]) {
        FS.trackingDelegate["willMovePath"](old_path, new_path)
      }
    } catch (e) {
      console.log("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
    }
    FS.hashRemoveNode(old_node);
    try {
      old_dir.node_ops.rename(old_node, new_dir, new_name)
    } catch (e) {
      throw e
    } finally {
      FS.hashAddNode(old_node)
    }
    try {
      if (FS.trackingDelegate["onMovePath"]) FS.trackingDelegate["onMovePath"](old_path, new_path)
    } catch (e) {
      console.log("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
    }
  }),
  rmdir: (function(path) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var err = FS.mayDelete(parent, name, true);
    if (err) {
      throw new FS.ErrnoError(err)
    }
    if (!parent.node_ops.rmdir) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM)
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
    }
    try {
      if (FS.trackingDelegate["willDeletePath"]) {
        FS.trackingDelegate["willDeletePath"](path)
      }
    } catch (e) {
      console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
    }
    parent.node_ops.rmdir(parent, name);
    FS.destroyNode(node);
    try {
      if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path)
    } catch (e) {
      console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
    }
  }),
  readdir: (function(path) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    var node = lookup.node;
    if (!node.node_ops.readdir) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR)
    }
    return node.node_ops.readdir(node)
  }),
  unlink: (function(path) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var err = FS.mayDelete(parent, name, false);
    if (err) {
      if (err === ERRNO_CODES.EISDIR) err = ERRNO_CODES.EPERM;
      throw new FS.ErrnoError(err)
    }
    if (!parent.node_ops.unlink) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM)
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
    }
    try {
      if (FS.trackingDelegate["willDeletePath"]) {
        FS.trackingDelegate["willDeletePath"](path)
      }
    } catch (e) {
      console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
    }
    parent.node_ops.unlink(parent, name);
    FS.destroyNode(node);
    try {
      if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path)
    } catch (e) {
      console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
    }
  }),
  readlink: (function(path) {
    var lookup = FS.lookupPath(path);
    var link = lookup.node;
    if (!link) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
    }
    if (!link.node_ops.readlink) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
    }
    return PATH.resolve(FS.getPath(lookup.node.parent), link.node_ops.readlink(link))
  }),
  stat: (function(path, dontFollow) {
    var lookup = FS.lookupPath(path, {
      follow: !dontFollow
    });
    var node = lookup.node;
    if (!node) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
    }
    if (!node.node_ops.getattr) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM)
    }
    return node.node_ops.getattr(node)
  }),
  lstat: (function(path) {
    return FS.stat(path, true)
  }),
  chmod: (function(path, mode, dontFollow) {
    var node;
    if (typeof path === "string") {
      var lookup = FS.lookupPath(path, {
        follow: !dontFollow
      });
      node = lookup.node
    } else {
      node = path
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM)
    }
    node.node_ops.setattr(node, {
      mode: mode & 4095 | node.mode & ~4095,
      timestamp: Date.now()
    })
  }),
  lchmod: (function(path, mode) {
    FS.chmod(path, mode, true)
  }),
  fchmod: (function(fd, mode) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(ERRNO_CODES.EBADF)
    }
    FS.chmod(stream.node, mode)
  }),
  chown: (function(path, uid, gid, dontFollow) {
    var node;
    if (typeof path === "string") {
      var lookup = FS.lookupPath(path, {
        follow: !dontFollow
      });
      node = lookup.node
    } else {
      node = path
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM)
    }
    node.node_ops.setattr(node, {
      timestamp: Date.now()
    })
  }),
  lchown: (function(path, uid, gid) {
    FS.chown(path, uid, gid, true)
  }),
  fchown: (function(fd, uid, gid) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(ERRNO_CODES.EBADF)
    }
    FS.chown(stream.node, uid, gid)
  }),
  truncate: (function(path, len) {
    if (len < 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
    }
    var node;
    if (typeof path === "string") {
      var lookup = FS.lookupPath(path, {
        follow: true
      });
      node = lookup.node
    } else {
      node = path
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM)
    }
    if (FS.isDir(node.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.EISDIR)
    }
    if (!FS.isFile(node.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
    }
    var err = FS.nodePermissions(node, "w");
    if (err) {
      throw new FS.ErrnoError(err)
    }
    node.node_ops.setattr(node, {
      size: len,
      timestamp: Date.now()
    })
  }),
  ftruncate: (function(fd, len) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(ERRNO_CODES.EBADF)
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
    }
    FS.truncate(stream.node, len)
  }),
  utime: (function(path, atime, mtime) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    var node = lookup.node;
    node.node_ops.setattr(node, {
      timestamp: Math.max(atime, mtime)
    })
  }),
  open: (function(path, flags, mode, fd_start, fd_end) {
    if (path === "") {
      throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
    }
    flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
    mode = typeof mode === "undefined" ? 438 : mode;
    if (flags & 64) {
      mode = mode & 4095 | 32768
    } else {
      mode = 0
    }
    var node;
    if (typeof path === "object") {
      node = path
    } else {
      path = PATH.normalize(path);
      try {
        var lookup = FS.lookupPath(path, {
          follow: !(flags & 131072)
        });
        node = lookup.node
      } catch (e) {}
    }
    var created = false;
    if (flags & 64) {
      if (node) {
        if (flags & 128) {
          throw new FS.ErrnoError(ERRNO_CODES.EEXIST)
        }
      } else {
        node = FS.mknod(path, mode, 0);
        created = true
      }
    }
    if (!node) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
    }
    if (FS.isChrdev(node.mode)) {
      flags &= ~512
    }
    if (!created) {
      var err = FS.mayOpen(node, flags);
      if (err) {
        throw new FS.ErrnoError(err)
      }
    }
    if (flags & 512) {
      FS.truncate(node, 0)
    }
    flags &= ~(128 | 512);
    var stream = FS.createStream({
      node: node,
      path: FS.getPath(node),
      flags: flags,
      seekable: true,
      position: 0,
      stream_ops: node.stream_ops,
      ungotten: [],
      error: false
    }, fd_start, fd_end);
    if (stream.stream_ops.open) {
      stream.stream_ops.open(stream)
    }
    if (Module["logReadFiles"] && !(flags & 1)) {
      if (!FS.readFiles) FS.readFiles = {};
      if (!(path in FS.readFiles)) {
        FS.readFiles[path] = 1;
        Module["printErr"]("read file: " + path)
      }
    }
    try {
      if (FS.trackingDelegate["onOpenFile"]) {
        var trackingFlags = 0;
        if ((flags & 2097155) !== 1) {
          trackingFlags |= FS.tracking.openFlags.READ
        }
        if ((flags & 2097155) !== 0) {
          trackingFlags |= FS.tracking.openFlags.WRITE
        }
        FS.trackingDelegate["onOpenFile"](path, trackingFlags)
      }
    } catch (e) {
      console.log("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message)
    }
    return stream
  }),
  close: (function(stream) {
    try {
      if (stream.stream_ops.close) {
        stream.stream_ops.close(stream)
      }
    } catch (e) {
      throw e
    } finally {
      FS.closeStream(stream.fd)
    }
  }),
  llseek: (function(stream, offset, whence) {
    if (!stream.seekable || !stream.stream_ops.llseek) {
      throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)
    }
    stream.position = stream.stream_ops.llseek(stream, offset, whence);
    stream.ungotten = [];
    return stream.position
  }),
  read: (function(stream, buffer, offset, length, position) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(ERRNO_CODES.EBADF)
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.EISDIR)
    }
    if (!stream.stream_ops.read) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
    }
    var seeking = true;
    if (typeof position === "undefined") {
      position = stream.position;
      seeking = false
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)
    }
    var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
    if (!seeking) stream.position += bytesRead;
    return bytesRead
  }),
  write: (function(stream, buffer, offset, length, position, canOwn) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EBADF)
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.EISDIR)
    }
    if (!stream.stream_ops.write) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
    }
    if (stream.flags & 1024) {
      FS.llseek(stream, 0, 2)
    }
    var seeking = true;
    if (typeof position === "undefined") {
      position = stream.position;
      seeking = false
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)
    }
    var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
    if (!seeking) stream.position += bytesWritten;
    try {
      if (stream.path && FS.trackingDelegate["onWriteToFile"]) FS.trackingDelegate["onWriteToFile"](stream.path)
    } catch (e) {
      console.log("FS.trackingDelegate['onWriteToFile']('" + path + "') threw an exception: " + e.message)
    }
    return bytesWritten
  }),
  allocate: (function(stream, offset, length) {
    if (offset < 0 || length <= 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EBADF)
    }
    if (!FS.isFile(stream.node.mode) && !FS.isDir(node.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
    }
    if (!stream.stream_ops.allocate) {
      throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP)
    }
    stream.stream_ops.allocate(stream, offset, length)
  }),
  mmap: (function(stream, buffer, offset, length, position, prot, flags) {
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(ERRNO_CODES.EACCES)
    }
    if (!stream.stream_ops.mmap) {
      throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
    }
    return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags)
  }),
  msync: (function(stream, buffer, offset, length, mmapFlags) {
    if (!stream || !stream.stream_ops.msync) {
      return 0
    }
    return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags)
  }),
  munmap: (function(stream) {
    return 0
  }),
  ioctl: (function(stream, cmd, arg) {
    if (!stream.stream_ops.ioctl) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOTTY)
    }
    return stream.stream_ops.ioctl(stream, cmd, arg)
  }),
  readFile: (function(path, opts) {
    opts = opts || {};
    opts.flags = opts.flags || "r";
    opts.encoding = opts.encoding || "binary";
    if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
      throw new Error('Invalid encoding type "' + opts.encoding + '"')
    }
    var ret;
    var stream = FS.open(path, opts.flags);
    var stat = FS.stat(path);
    var length = stat.size;
    var buf = new Uint8Array(length);
    FS.read(stream, buf, 0, length, 0);
    if (opts.encoding === "utf8") {
      ret = UTF8ArrayToString(buf, 0)
    } else if (opts.encoding === "binary") {
      ret = buf
    }
    FS.close(stream);
    return ret
  }),
  writeFile: (function(path, data, opts) {
    opts = opts || {};
    opts.flags = opts.flags || "w";
    opts.encoding = opts.encoding || "utf8";
    if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
      throw new Error('Invalid encoding type "' + opts.encoding + '"')
    }
    var stream = FS.open(path, opts.flags, opts.mode);
    if (opts.encoding === "utf8") {
      var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
      var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
      FS.write(stream, buf, 0, actualNumBytes, 0, opts.canOwn)
    } else if (opts.encoding === "binary") {
      FS.write(stream, data, 0, data.length, 0, opts.canOwn)
    }
    FS.close(stream)
  }),
  cwd: (function() {
    return FS.currentPath
  }),
  chdir: (function(path) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    if (!FS.isDir(lookup.node.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR)
    }
    var err = FS.nodePermissions(lookup.node, "x");
    if (err) {
      throw new FS.ErrnoError(err)
    }
    FS.currentPath = lookup.path
  }),
  createDefaultDirectories: (function() {
    FS.mkdir("/tmp");
    FS.mkdir("/home");
    FS.mkdir("/home/web_user")
  }),
  createDefaultDevices: (function() {
    FS.mkdir("/dev");
    FS.registerDevice(FS.makedev(1, 3), {
      read: (function() {
        return 0
      }),
      write: (function(stream, buffer, offset, length, pos) {
        return length
      })
    });
    FS.mkdev("/dev/null", FS.makedev(1, 3));
    TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
    TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
    FS.mkdev("/dev/tty", FS.makedev(5, 0));
    FS.mkdev("/dev/tty1", FS.makedev(6, 0));
    var random_device;
    if (typeof crypto !== "undefined") {
      var randomBuffer = new Uint8Array(1);
      random_device = (function() {
        crypto.getRandomValues(randomBuffer);
        return randomBuffer[0]
      })
    } else if (ENVIRONMENT_IS_NODE) {
      random_device = (function() {
        return require("crypto").randomBytes(1)[0]
      })
    } else {
      random_device = (function() {
        return Math.random() * 256 | 0
      })
    }
    FS.createDevice("/dev", "random", random_device);
    FS.createDevice("/dev", "urandom", random_device);
    FS.mkdir("/dev/shm");
    FS.mkdir("/dev/shm/tmp")
  }),
  createStandardStreams: (function() {
    if (Module["stdin"]) {
      FS.createDevice("/dev", "stdin", Module["stdin"])
    } else {
      FS.symlink("/dev/tty", "/dev/stdin")
    }
    if (Module["stdout"]) {
      FS.createDevice("/dev", "stdout", null, Module["stdout"])
    } else {
      FS.symlink("/dev/tty", "/dev/stdout")
    }
    if (Module["stderr"]) {
      FS.createDevice("/dev", "stderr", null, Module["stderr"])
    } else {
      FS.symlink("/dev/tty1", "/dev/stderr")
    }
    var stdin = FS.open("/dev/stdin", "r");
    HEAP32[_stdin >> 2] = FS.getPtrForStream(stdin);
    assert(stdin.fd === 0, "invalid handle for stdin (" + stdin.fd + ")");
    var stdout = FS.open("/dev/stdout", "w");
    HEAP32[_stdout >> 2] = FS.getPtrForStream(stdout);
    assert(stdout.fd === 1, "invalid handle for stdout (" + stdout.fd + ")");
    var stderr = FS.open("/dev/stderr", "w");
    HEAP32[_stderr >> 2] = FS.getPtrForStream(stderr);
    assert(stderr.fd === 2, "invalid handle for stderr (" + stderr.fd + ")")
  }),
  ensureErrnoError: (function() {
    if (FS.ErrnoError) return;
    FS.ErrnoError = function ErrnoError(errno, node) {
      this.node = node;
      this.setErrno = (function(errno) {
        this.errno = errno;
        for (var key in ERRNO_CODES) {
          if (ERRNO_CODES[key] === errno) {
            this.code = key;
            break
          }
        }
      });
      this.setErrno(errno);
      this.message = ERRNO_MESSAGES[errno]
    };
    FS.ErrnoError.prototype = new Error;
    FS.ErrnoError.prototype.constructor = FS.ErrnoError;
    [ERRNO_CODES.ENOENT].forEach((function(code) {
      FS.genericErrors[code] = new FS.ErrnoError(code);
      FS.genericErrors[code].stack = "<generic error, no stack>"
    }))
  }),
  staticInit: (function() {
    FS.ensureErrnoError();
    FS.nameTable = new Array(4096);
    FS.mount(MEMFS, {}, "/");
    FS.createDefaultDirectories();
    FS.createDefaultDevices()
  }),
  init: (function(input, output, error) {
    assert(!FS.init.initialized, "FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)");
    FS.init.initialized = true;
    FS.ensureErrnoError();
    Module["stdin"] = input || Module["stdin"];
    Module["stdout"] = output || Module["stdout"];
    Module["stderr"] = error || Module["stderr"];
    FS.createStandardStreams()
  }),
  quit: (function() {
    FS.init.initialized = false;
    for (var i = 0; i < FS.streams.length; i++) {
      var stream = FS.streams[i];
      if (!stream) {
        continue
      }
      FS.close(stream)
    }
  }),
  getMode: (function(canRead, canWrite) {
    var mode = 0;
    if (canRead) mode |= 292 | 73;
    if (canWrite) mode |= 146;
    return mode
  }),
  joinPath: (function(parts, forceRelative) {
    var path = PATH.join.apply(null, parts);
    if (forceRelative && path[0] == "/") path = path.substr(1);
    return path
  }),
  absolutePath: (function(relative, base) {
    return PATH.resolve(base, relative)
  }),
  standardizePath: (function(path) {
    return PATH.normalize(path)
  }),
  findObject: (function(path, dontResolveLastLink) {
    var ret = FS.analyzePath(path, dontResolveLastLink);
    if (ret.exists) {
      return ret.object
    } else {
      ___setErrNo(ret.error);
      return null
    }
  }),
  analyzePath: (function(path, dontResolveLastLink) {
    try {
      var lookup = FS.lookupPath(path, {
        follow: !dontResolveLastLink
      });
      path = lookup.path
    } catch (e) {}
    var ret = {
      isRoot: false,
      exists: false,
      error: 0,
      name: null,
      path: null,
      object: null,
      parentExists: false,
      parentPath: null,
      parentObject: null
    };
    try {
      var lookup = FS.lookupPath(path, {
        parent: true
      });
      ret.parentExists = true;
      ret.parentPath = lookup.path;
      ret.parentObject = lookup.node;
      ret.name = PATH.basename(path);
      lookup = FS.lookupPath(path, {
        follow: !dontResolveLastLink
      });
      ret.exists = true;
      ret.path = lookup.path;
      ret.object = lookup.node;
      ret.name = lookup.node.name;
      ret.isRoot = lookup.path === "/"
    } catch (e) {
      ret.error = e.errno
    }
    return ret
  }),
  createFolder: (function(parent, name, canRead, canWrite) {
    var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
    var mode = FS.getMode(canRead, canWrite);
    return FS.mkdir(path, mode)
  }),
  createPath: (function(parent, path, canRead, canWrite) {
    parent = typeof parent === "string" ? parent : FS.getPath(parent);
    var parts = path.split("/").reverse();
    while (parts.length) {
      var part = parts.pop();
      if (!part) continue;
      var current = PATH.join2(parent, part);
      try {
        FS.mkdir(current)
      } catch (e) {}
      parent = current
    }
    return current
  }),
  createFile: (function(parent, name, properties, canRead, canWrite) {
    var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
    var mode = FS.getMode(canRead, canWrite);
    return FS.create(path, mode)
  }),
  createDataFile: (function(parent, name, data, canRead, canWrite, canOwn) {
    var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
    var mode = FS.getMode(canRead, canWrite);
    var node = FS.create(path, mode);
    if (data) {
      if (typeof data === "string") {
        var arr = new Array(data.length);
        for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
        data = arr
      }
      FS.chmod(node, mode | 146);
      var stream = FS.open(node, "w");
      FS.write(stream, data, 0, data.length, 0, canOwn);
      FS.close(stream);
      FS.chmod(node, mode)
    }
    return node
  }),
  createDevice: (function(parent, name, input, output) {
    var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
    var mode = FS.getMode(!!input, !!output);
    if (!FS.createDevice.major) FS.createDevice.major = 64;
    var dev = FS.makedev(FS.createDevice.major++, 0);
    FS.registerDevice(dev, {
      open: (function(stream) {
        stream.seekable = false
      }),
      close: (function(stream) {
        if (output && output.buffer && output.buffer.length) {
          output(10)
        }
      }),
      read: (function(stream, buffer, offset, length, pos) {
        var bytesRead = 0;
        for (var i = 0; i < length; i++) {
          var result;
          try {
            result = input()
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO)
          }
          if (result === undefined && bytesRead === 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
          }
          if (result === null || result === undefined) break;
          bytesRead++;
          buffer[offset + i] = result
        }
        if (bytesRead) {
          stream.node.timestamp = Date.now()
        }
        return bytesRead
      }),
      write: (function(stream, buffer, offset, length, pos) {
        for (var i = 0; i < length; i++) {
          try {
            output(buffer[offset + i])
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO)
          }
        }
        if (length) {
          stream.node.timestamp = Date.now()
        }
        return i
      })
    });
    return FS.mkdev(path, mode, dev)
  }),
  createLink: (function(parent, name, target, canRead, canWrite) {
    var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
    return FS.symlink(target, path)
  }),
  forceLoadFile: (function(obj) {
    if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
    var success = true;
    if (typeof XMLHttpRequest !== "undefined") {
      throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.")
    } else if (Module["read"]) {
      try {
        obj.contents = intArrayFromString(Module["read"](obj.url), true);
        obj.usedBytes = obj.contents.length
      } catch (e) {
        success = false
      }
    } else {
      throw new Error("Cannot load without read() or XMLHttpRequest.")
    }
    if (!success) ___setErrNo(ERRNO_CODES.EIO);
    return success
  }),
  createLazyFile: (function(parent, name, url, canRead, canWrite) {
    function LazyUint8Array() {
      this.lengthKnown = false;
      this.chunks = []
    }
    LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
      if (idx > this.length - 1 || idx < 0) {
        return undefined
      }
      var chunkOffset = idx % this.chunkSize;
      var chunkNum = idx / this.chunkSize | 0;
      return this.getter(chunkNum)[chunkOffset]
    };
    LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
      this.getter = getter
    };
    LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
      var xhr = new XMLHttpRequest;
      xhr.open("HEAD", url, false);
      xhr.send(null);
      if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
      var datalength = Number(xhr.getResponseHeader("Content-length"));
      var header;
      var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
      var chunkSize = 1024 * 1024;
      if (!hasByteServing) chunkSize = datalength;
      var doXHR = (function(from, to) {
        if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
        if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
        var xhr = new XMLHttpRequest;
        xhr.open("GET", url, false);
        if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
        if (typeof Uint8Array != "undefined") xhr.responseType = "arraybuffer";
        if (xhr.overrideMimeType) {
          xhr.overrideMimeType("text/plain; charset=x-user-defined")
        }
        xhr.send(null);
        if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
        if (xhr.response !== undefined) {
          return new Uint8Array(xhr.response || [])
        } else {
          return intArrayFromString(xhr.responseText || "", true)
        }
      });
      var lazyArray = this;
      lazyArray.setDataGetter((function(chunkNum) {
        var start = chunkNum * chunkSize;
        var end = (chunkNum + 1) * chunkSize - 1;
        end = Math.min(end, datalength - 1);
        if (typeof lazyArray.chunks[chunkNum] === "undefined") {
          lazyArray.chunks[chunkNum] = doXHR(start, end)
        }
        if (typeof lazyArray.chunks[chunkNum] === "undefined") throw new Error("doXHR failed!");
        return lazyArray.chunks[chunkNum]
      }));
      this._length = datalength;
      this._chunkSize = chunkSize;
      this.lengthKnown = true
    };
    if (typeof XMLHttpRequest !== "undefined") {
      if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
      var lazyArray = new LazyUint8Array;
      Object.defineProperty(lazyArray, "length", {
        get: (function() {
          if (!this.lengthKnown) {
            this.cacheLength()
          }
          return this._length
        })
      });
      Object.defineProperty(lazyArray, "chunkSize", {
        get: (function() {
          if (!this.lengthKnown) {
            this.cacheLength()
          }
          return this._chunkSize
        })
      });
      var properties = {
        isDevice: false,
        contents: lazyArray
      }
    } else {
      var properties = {
        isDevice: false,
        url: url
      }
    }
    var node = FS.createFile(parent, name, properties, canRead, canWrite);
    if (properties.contents) {
      node.contents = properties.contents
    } else if (properties.url) {
      node.contents = null;
      node.url = properties.url
    }
    Object.defineProperty(node, "usedBytes", {
      get: (function() {
        return this.contents.length
      })
    });
    var stream_ops = {};
    var keys = Object.keys(node.stream_ops);
    keys.forEach((function(key) {
      var fn = node.stream_ops[key];
      stream_ops[key] = function forceLoadLazyFile() {
        if (!FS.forceLoadFile(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EIO)
        }
        return fn.apply(null, arguments)
      }
    }));
    stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
      if (!FS.forceLoadFile(node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EIO)
      }
      var contents = stream.node.contents;
      if (position >= contents.length) return 0;
      var size = Math.min(contents.length - position, length);
      assert(size >= 0);
      if (contents.slice) {
        for (var i = 0; i < size; i++) {
          buffer[offset + i] = contents[position + i]
        }
      } else {
        for (var i = 0; i < size; i++) {
          buffer[offset + i] = contents.get(position + i)
        }
      }
      return size
    };
    node.stream_ops = stream_ops;
    return node
  }),
  createPreloadedFile: (function(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
    Browser.init();
    var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
    var dep = getUniqueRunDependency("cp " + fullname);

    function processData(byteArray) {
      function finish(byteArray) {
        if (preFinish) preFinish();
        if (!dontCreateFile) {
          FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn)
        }
        if (onload) onload();
        removeRunDependency(dep)
      }
      var handled = false;
      Module["preloadPlugins"].forEach((function(plugin) {
        if (handled) return;
        if (plugin["canHandle"](fullname)) {
          plugin["handle"](byteArray, fullname, finish, (function() {
            if (onerror) onerror();
            removeRunDependency(dep)
          }));
          handled = true
        }
      }));
      if (!handled) finish(byteArray)
    }
    addRunDependency(dep);
    if (typeof url == "string") {
      Browser.asyncLoad(url, (function(byteArray) {
        processData(byteArray)
      }), onerror)
    } else {
      processData(url)
    }
  }),
  indexedDB: (function() {
    return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
  }),
  DB_NAME: (function() {
    return "EM_FS_" + window.location.pathname
  }),
  DB_VERSION: 20,
  DB_STORE_NAME: "FILE_DATA",
  saveFilesToDB: (function(paths, onload, onerror) {
    onload = onload || (function() {});
    onerror = onerror || (function() {});
    var indexedDB = FS.indexedDB();
    try {
      var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
    } catch (e) {
      return onerror(e)
    }
    openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
      console.log("creating db");
      var db = openRequest.result;
      db.createObjectStore(FS.DB_STORE_NAME)
    };
    openRequest.onsuccess = function openRequest_onsuccess() {
      var db = openRequest.result;
      var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
      var files = transaction.objectStore(FS.DB_STORE_NAME);
      var ok = 0,
        fail = 0,
        total = paths.length;

      function finish() {
        if (fail == 0) onload();
        else onerror()
      }
      paths.forEach((function(path) {
        var putRequest = files.put(FS.analyzePath(path).object.contents, path);
        putRequest.onsuccess = function putRequest_onsuccess() {
          ok++;
          if (ok + fail == total) finish()
        };
        putRequest.onerror = function putRequest_onerror() {
          fail++;
          if (ok + fail == total) finish()
        }
      }));
      transaction.onerror = onerror
    };
    openRequest.onerror = onerror
  }),
  loadFilesFromDB: (function(paths, onload, onerror) {
    onload = onload || (function() {});
    onerror = onerror || (function() {});
    var indexedDB = FS.indexedDB();
    try {
      var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
    } catch (e) {
      return onerror(e)
    }
    openRequest.onupgradeneeded = onerror;
    openRequest.onsuccess = function openRequest_onsuccess() {
      var db = openRequest.result;
      try {
        var transaction = db.transaction([FS.DB_STORE_NAME], "readonly")
      } catch (e) {
        onerror(e);
        return
      }
      var files = transaction.objectStore(FS.DB_STORE_NAME);
      var ok = 0,
        fail = 0,
        total = paths.length;

      function finish() {
        if (fail == 0) onload();
        else onerror()
      }
      paths.forEach((function(path) {
        var getRequest = files.get(path);
        getRequest.onsuccess = function getRequest_onsuccess() {
          if (FS.analyzePath(path).exists) {
            FS.unlink(path)
          }
          FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
          ok++;
          if (ok + fail == total) finish()
        };
        getRequest.onerror = function getRequest_onerror() {
          fail++;
          if (ok + fail == total) finish()
        }
      }));
      transaction.onerror = onerror
    };
    openRequest.onerror = onerror
  })
};

function _close(fildes) {
  var stream = FS.getStream(fildes);
  if (!stream) {
    ___setErrNo(ERRNO_CODES.EBADF);
    return -1
  }
  try {
    FS.close(stream);
    return 0
  } catch (e) {
    FS.handleFSError(e);
    return -1
  }
}

function _fileno(stream) {
  stream = FS.getStreamFromPtr(stream);
  if (!stream) return -1;
  return stream.fd
}

function _fclose(stream) {
  var fd = _fileno(stream);
  return _close(fd)
}
var _emscripten_resume = true;

function _pthread_mutex_lock() {}

function _free() {}
Module["_free"] = _free;

function ___cxa_free_exception(ptr) {
  try {
    return _free(ptr)
  } catch (e) {}
}

function ___cxa_end_catch() {
  if (___cxa_end_catch.rethrown) {
    ___cxa_end_catch.rethrown = false;
    return
  }
  asm["setThrew"](0);
  var ptr = EXCEPTIONS.caught.pop();
  if (ptr) {
    EXCEPTIONS.decRef(EXCEPTIONS.deAdjust(ptr));
    EXCEPTIONS.last = 0
  }
}

function _open(path, oflag, varargs) {
  var mode = HEAP32[varargs >> 2];
  path = Pointer_stringify(path);
  try {
    var stream = FS.open(path, oflag, mode);
    return stream.fd
  } catch (e) {
    FS.handleFSError(e);
    return -1
  }
}

function _fopen(filename, mode) {
  var flags;
  mode = Pointer_stringify(mode);
  if (mode[0] == "r") {
    if (mode.indexOf("+") != -1) {
      flags = 2
    } else {
      flags = 0
    }
  } else if (mode[0] == "w") {
    if (mode.indexOf("+") != -1) {
      flags = 2
    } else {
      flags = 1
    }
    flags |= 64;
    flags |= 512
  } else if (mode[0] == "a") {
    if (mode.indexOf("+") != -1) {
      flags = 2
    } else {
      flags = 1
    }
    flags |= 64;
    flags |= 1024
  } else {
    ___setErrNo(ERRNO_CODES.EINVAL);
    return 0
  }
  var fd = _open(filename, flags, allocate([511, 0, 0, 0], "i32", ALLOC_STACK));
  return fd === -1 ? 0 : FS.getPtrForStream(FS.getStream(fd))
}

function _mkport() {
  throw "TODO"
}
var SOCKFS = {
  mount: (function(mount) {
    Module["websocket"] = Module["websocket"] && "object" === typeof Module["websocket"] ? Module["websocket"] : {};
    Module["websocket"]._callbacks = {};
    Module["websocket"]["on"] = (function(event, callback) {
      if ("function" === typeof callback) {
        this._callbacks[event] = callback
      }
      return this
    });
    Module["websocket"].emit = (function(event, param) {
      if ("function" === typeof this._callbacks[event]) {
        this._callbacks[event].call(this, param)
      }
    });
    return FS.createNode(null, "/", 16384 | 511, 0)
  }),
  createSocket: (function(family, type, protocol) {
    var streaming = type == 1;
    if (protocol) {
      assert(streaming == (protocol == 6))
    }
    var sock = {
      family: family,
      type: type,
      protocol: protocol,
      server: null,
      error: null,
      peers: {},
      pending: [],
      recv_queue: [],
      sock_ops: SOCKFS.websocket_sock_ops
    };
    var name = SOCKFS.nextname();
    var node = FS.createNode(SOCKFS.root, name, 49152, 0);
    node.sock = sock;
    var stream = FS.createStream({
      path: name,
      node: node,
      flags: FS.modeStringToFlags("r+"),
      seekable: false,
      stream_ops: SOCKFS.stream_ops
    });
    sock.stream = stream;
    return sock
  }),
  getSocket: (function(fd) {
    var stream = FS.getStream(fd);
    if (!stream || !FS.isSocket(stream.node.mode)) {
      return null
    }
    return stream.node.sock
  }),
  stream_ops: {
    poll: (function(stream) {
      var sock = stream.node.sock;
      return sock.sock_ops.poll(sock)
    }),
    ioctl: (function(stream, request, varargs) {
      var sock = stream.node.sock;
      return sock.sock_ops.ioctl(sock, request, varargs)
    }),
    read: (function(stream, buffer, offset, length, position) {
      var sock = stream.node.sock;
      var msg = sock.sock_ops.recvmsg(sock, length);
      if (!msg) {
        return 0
      }
      buffer.set(msg.buffer, offset);
      return msg.buffer.length
    }),
    write: (function(stream, buffer, offset, length, position) {
      var sock = stream.node.sock;
      return sock.sock_ops.sendmsg(sock, buffer, offset, length)
    }),
    close: (function(stream) {
      var sock = stream.node.sock;
      sock.sock_ops.close(sock)
    })
  },
  nextname: (function() {
    if (!SOCKFS.nextname.current) {
      SOCKFS.nextname.current = 0
    }
    return "socket[" + SOCKFS.nextname.current++ + "]"
  }),
  websocket_sock_ops: {
    createPeer: (function(sock, addr, port) {
      var ws;
      if (typeof addr === "object") {
        ws = addr;
        addr = null;
        port = null
      }
      if (ws) {
        if (ws._socket) {
          addr = ws._socket.remoteAddress;
          port = ws._socket.remotePort
        } else {
          var result = /ws[s]?:\/\/([^:]+):(\d+)/.exec(ws.url);
          if (!result) {
            throw new Error("WebSocket URL must be in the format ws(s)://address:port")
          }
          addr = result[1];
          port = parseInt(result[2], 10)
        }
      } else {
        try {
          var runtimeConfig = Module["websocket"] && "object" === typeof Module["websocket"];
          var url = "ws:#".replace("#", "//");
          if (runtimeConfig) {
            if ("string" === typeof Module["websocket"]["url"]) {
              url = Module["websocket"]["url"]
            }
          }
          if (url === "ws://" || url === "wss://") {
            var parts = addr.split("/");
            url = url + parts[0] + ":" + port + "/" + parts.slice(1).join("/")
          }
          var subProtocols = "binary";
          if (runtimeConfig) {
            if ("string" === typeof Module["websocket"]["subprotocol"]) {
              subProtocols = Module["websocket"]["subprotocol"]
            }
          }
          subProtocols = subProtocols.replace(/^ +| +$/g, "").split(/ *, */);
          var opts = ENVIRONMENT_IS_NODE ? {
            "protocol": subProtocols.toString()
          } : subProtocols;
          var WebSocket = ENVIRONMENT_IS_NODE ? require("ws") : window["WebSocket"];
          ws = new WebSocket(url, opts);
          ws.binaryType = "arraybuffer"
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES.EHOSTUNREACH)
        }
      }
      var peer = {
        addr: addr,
        port: port,
        socket: ws,
        dgram_send_queue: []
      };
      SOCKFS.websocket_sock_ops.addPeer(sock, peer);
      SOCKFS.websocket_sock_ops.handlePeerEvents(sock, peer);
      if (sock.type === 2 && typeof sock.sport !== "undefined") {
        peer.dgram_send_queue.push(new Uint8Array([255, 255, 255, 255, "p".charCodeAt(0), "o".charCodeAt(0), "r".charCodeAt(0), "t".charCodeAt(0), (sock.sport & 65280) >> 8, sock.sport & 255]))
      }
      return peer
    }),
    getPeer: (function(sock, addr, port) {
      return sock.peers[addr + ":" + port]
    }),
    addPeer: (function(sock, peer) {
      sock.peers[peer.addr + ":" + peer.port] = peer
    }),
    removePeer: (function(sock, peer) {
      delete sock.peers[peer.addr + ":" + peer.port]
    }),
    handlePeerEvents: (function(sock, peer) {
      var first = true;
      var handleOpen = (function() {
        Module["websocket"].emit("open", sock.stream.fd);
        try {
          var queued = peer.dgram_send_queue.shift();
          while (queued) {
            peer.socket.send(queued);
            queued = peer.dgram_send_queue.shift()
          }
        } catch (e) {
          peer.socket.close()
        }
      });

      function handleMessage(data) {
        assert(typeof data !== "string" && data.byteLength !== undefined);
        data = new Uint8Array(data);
        var wasfirst = first;
        first = false;
        if (wasfirst && data.length === 10 && data[0] === 255 && data[1] === 255 && data[2] === 255 && data[3] === 255 && data[4] === "p".charCodeAt(0) && data[5] === "o".charCodeAt(0) && data[6] === "r".charCodeAt(0) && data[7] === "t".charCodeAt(0)) {
          var newport = data[8] << 8 | data[9];
          SOCKFS.websocket_sock_ops.removePeer(sock, peer);
          peer.port = newport;
          SOCKFS.websocket_sock_ops.addPeer(sock, peer);
          return
        }
        sock.recv_queue.push({
          addr: peer.addr,
          port: peer.port,
          data: data
        });
        Module["websocket"].emit("message", sock.stream.fd)
      }
      if (ENVIRONMENT_IS_NODE) {
        peer.socket.on("open", handleOpen);
        peer.socket.on("message", (function(data, flags) {
          if (!flags.binary) {
            return
          }
          handleMessage((new Uint8Array(data)).buffer)
        }));
        peer.socket.on("close", (function() {
          Module["websocket"].emit("close", sock.stream.fd)
        }));
        peer.socket.on("error", (function(error) {
          sock.error = ERRNO_CODES.ECONNREFUSED;
          Module["websocket"].emit("error", [sock.stream.fd, sock.error, "ECONNREFUSED: Connection refused"])
        }))
      } else {
        peer.socket.onopen = handleOpen;
        peer.socket.onclose = (function() {
          Module["websocket"].emit("close", sock.stream.fd)
        });
        peer.socket.onmessage = function peer_socket_onmessage(event) {
          handleMessage(event.data)
        };
        peer.socket.onerror = (function(error) {
          sock.error = ERRNO_CODES.ECONNREFUSED;
          Module["websocket"].emit("error", [sock.stream.fd, sock.error, "ECONNREFUSED: Connection refused"])
        })
      }
    }),
    poll: (function(sock) {
      if (sock.type === 1 && sock.server) {
        return sock.pending.length ? 64 | 1 : 0
      }
      var mask = 0;
      var dest = sock.type === 1 ? SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport) : null;
      if (sock.recv_queue.length || !dest || dest && dest.socket.readyState === dest.socket.CLOSING || dest && dest.socket.readyState === dest.socket.CLOSED) {
        mask |= 64 | 1
      }
      if (!dest || dest && dest.socket.readyState === dest.socket.OPEN) {
        mask |= 4
      }
      if (dest && dest.socket.readyState === dest.socket.CLOSING || dest && dest.socket.readyState === dest.socket.CLOSED) {
        mask |= 16
      }
      return mask
    }),
    ioctl: (function(sock, request, arg) {
      switch (request) {
        case 21531:
          var bytes = 0;
          if (sock.recv_queue.length) {
            bytes = sock.recv_queue[0].data.length
          }
          HEAP32[arg >> 2] = bytes;
          return 0;
        default:
          return ERRNO_CODES.EINVAL
      }
    }),
    close: (function(sock) {
      if (sock.server) {
        try {
          sock.server.close()
        } catch (e) {}
        sock.server = null
      }
      var peers = Object.keys(sock.peers);
      for (var i = 0; i < peers.length; i++) {
        var peer = sock.peers[peers[i]];
        try {
          peer.socket.close()
        } catch (e) {}
        SOCKFS.websocket_sock_ops.removePeer(sock, peer)
      }
      return 0
    }),
    bind: (function(sock, addr, port) {
      if (typeof sock.saddr !== "undefined" || typeof sock.sport !== "undefined") {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      sock.saddr = addr;
      sock.sport = port || _mkport();
      if (sock.type === 2) {
        if (sock.server) {
          sock.server.close();
          sock.server = null
        }
        try {
          sock.sock_ops.listen(sock, 0)
        } catch (e) {
          if (!(e instanceof FS.ErrnoError)) throw e;
          if (e.errno !== ERRNO_CODES.EOPNOTSUPP) throw e
        }
      }
    }),
    connect: (function(sock, addr, port) {
      if (sock.server) {
        throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP)
      }
      if (typeof sock.daddr !== "undefined" && typeof sock.dport !== "undefined") {
        var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
        if (dest) {
          if (dest.socket.readyState === dest.socket.CONNECTING) {
            throw new FS.ErrnoError(ERRNO_CODES.EALREADY)
          } else {
            throw new FS.ErrnoError(ERRNO_CODES.EISCONN)
          }
        }
      }
      var peer = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
      sock.daddr = peer.addr;
      sock.dport = peer.port;
      throw new FS.ErrnoError(ERRNO_CODES.EINPROGRESS)
    }),
    listen: (function(sock, backlog) {
      if (!ENVIRONMENT_IS_NODE) {
        throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP)
      }
      if (sock.server) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      var WebSocketServer = require("ws").Server;
      var host = sock.saddr;
      sock.server = new WebSocketServer({
        host: host,
        port: sock.sport
      });
      Module["websocket"].emit("listen", sock.stream.fd);
      sock.server.on("connection", (function(ws) {
        if (sock.type === 1) {
          var newsock = SOCKFS.createSocket(sock.family, sock.type, sock.protocol);
          var peer = SOCKFS.websocket_sock_ops.createPeer(newsock, ws);
          newsock.daddr = peer.addr;
          newsock.dport = peer.port;
          sock.pending.push(newsock);
          Module["websocket"].emit("connection", newsock.stream.fd)
        } else {
          SOCKFS.websocket_sock_ops.createPeer(sock, ws);
          Module["websocket"].emit("connection", sock.stream.fd)
        }
      }));
      sock.server.on("closed", (function() {
        Module["websocket"].emit("close", sock.stream.fd);
        sock.server = null
      }));
      sock.server.on("error", (function(error) {
        sock.error = ERRNO_CODES.EHOSTUNREACH;
        Module["websocket"].emit("error", [sock.stream.fd, sock.error, "EHOSTUNREACH: Host is unreachable"])
      }))
    }),
    accept: (function(listensock) {
      if (!listensock.server) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      var newsock = listensock.pending.shift();
      newsock.stream.flags = listensock.stream.flags;
      return newsock
    }),
    getname: (function(sock, peer) {
      var addr, port;
      if (peer) {
        if (sock.daddr === undefined || sock.dport === undefined) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN)
        }
        addr = sock.daddr;
        port = sock.dport
      } else {
        addr = sock.saddr || 0;
        port = sock.sport || 0
      }
      return {
        addr: addr,
        port: port
      }
    }),
    sendmsg: (function(sock, buffer, offset, length, addr, port) {
      if (sock.type === 2) {
        if (addr === undefined || port === undefined) {
          addr = sock.daddr;
          port = sock.dport
        }
        if (addr === undefined || port === undefined) {
          throw new FS.ErrnoError(ERRNO_CODES.EDESTADDRREQ)
        }
      } else {
        addr = sock.daddr;
        port = sock.dport
      }
      var dest = SOCKFS.websocket_sock_ops.getPeer(sock, addr, port);
      if (sock.type === 1) {
        if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN)
        } else if (dest.socket.readyState === dest.socket.CONNECTING) {
          throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
        }
      }
      var data;
      if (buffer instanceof Array || buffer instanceof ArrayBuffer) {
        data = buffer.slice(offset, offset + length)
      } else {
        data = buffer.buffer.slice(buffer.byteOffset + offset, buffer.byteOffset + offset + length)
      }
      if (sock.type === 2) {
        if (!dest || dest.socket.readyState !== dest.socket.OPEN) {
          if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
            dest = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port)
          }
          dest.dgram_send_queue.push(data);
          return length
        }
      }
      try {
        dest.socket.send(data);
        return length
      } catch (e) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
    }),
    recvmsg: (function(sock, length) {
      if (sock.type === 1 && sock.server) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN)
      }
      var queued = sock.recv_queue.shift();
      if (!queued) {
        if (sock.type === 1) {
          var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
          if (!dest) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN)
          } else if (dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
            return null
          } else {
            throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
          }
        } else {
          throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
        }
      }
      var queuedLength = queued.data.byteLength || queued.data.length;
      var queuedOffset = queued.data.byteOffset || 0;
      var queuedBuffer = queued.data.buffer || queued.data;
      var bytesRead = Math.min(length, queuedLength);
      var res = {
        buffer: new Uint8Array(queuedBuffer, queuedOffset, bytesRead),
        addr: queued.addr,
        port: queued.port
      };
      if (sock.type === 1 && bytesRead < queuedLength) {
        var bytesRemaining = queuedLength - bytesRead;
        queued.data = new Uint8Array(queuedBuffer, queuedOffset + bytesRead, bytesRemaining);
        sock.recv_queue.unshift(queued)
      }
      return res
    })
  }
};

function _send(fd, buf, len, flags) {
  var sock = SOCKFS.getSocket(fd);
  if (!sock) {
    ___setErrNo(ERRNO_CODES.EBADF);
    return -1
  }
  return _write(fd, buf, len)
}

function _pwrite(fildes, buf, nbyte, offset) {
  var stream = FS.getStream(fildes);
  if (!stream) {
    ___setErrNo(ERRNO_CODES.EBADF);
    return -1
  }
  try {
    var slab = HEAP8;
    return FS.write(stream, slab, buf, nbyte, offset)
  } catch (e) {
    FS.handleFSError(e);
    return -1
  }
}

function _write(fildes, buf, nbyte) {
  var stream = FS.getStream(fildes);
  if (!stream) {
    ___setErrNo(ERRNO_CODES.EBADF);
    return -1
  }
  try {
    var slab = HEAP8;
    return FS.write(stream, slab, buf, nbyte)
  } catch (e) {
    FS.handleFSError(e);
    return -1
  }
}

function _fputc(c, stream) {
  var chr = unSign(c & 255);
  HEAP8[_fputc.ret >> 0] = chr;
  var fd = _fileno(stream);
  var ret = _write(fd, _fputc.ret, 1);
  if (ret == -1) {
    var streamObj = FS.getStreamFromPtr(stream);
    if (streamObj) streamObj.error = true;
    return -1
  } else {
    return chr
  }
}

function ___assert_fail(condition, filename, line, func) {
  ABORT = true;
  throw "Assertion failed: " + Pointer_stringify(condition) + ", at: " + [filename ? Pointer_stringify(filename) : "unknown filename", line, func ? Pointer_stringify(func) : "unknown function"] + " at " + stackTrace()
}
var _emscripten_postinvoke = true;

function _fwrite(ptr, size, nitems, stream) {
  var bytesToWrite = nitems * size;
  if (bytesToWrite == 0) return 0;
  var fd = _fileno(stream);
  var bytesWritten = _write(fd, ptr, bytesToWrite);
  if (bytesWritten == -1) {
    var streamObj = FS.getStreamFromPtr(stream);
    if (streamObj) streamObj.error = true;
    return 0
  } else {
    return bytesWritten / size | 0
  }
}
var DLFCN = {
  error: null,
  errorMsg: null,
  loadedLibs: {},
  loadedLibNames: {}
};

function _dlerror() {
  if (DLFCN.errorMsg === null) {
    return 0
  } else {
    if (DLFCN.error) _free(DLFCN.error);
    var msgArr = intArrayFromString(DLFCN.errorMsg);
    DLFCN.error = allocate(msgArr, "i8", ALLOC_NORMAL);
    DLFCN.errorMsg = null;
    return DLFCN.error
  }
}

function _time(ptr) {
  var ret = Date.now() / 1e3 | 0;
  if (ptr) {
    HEAP32[ptr >> 2] = ret
  }
  return ret
}

function _emscripten_set_main_loop_timing(mode, value) {
  Browser.mainLoop.timingMode = mode;
  Browser.mainLoop.timingValue = value;
  if (!Browser.mainLoop.func) {
    return 1
  }
  if (mode == 0) {
    Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler() {
      setTimeout(Browser.mainLoop.runner, value)
    };
    Browser.mainLoop.method = "timeout"
  } else if (mode == 1) {
    Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler() {
      Browser.requestAnimationFrame(Browser.mainLoop.runner)
    };
    Browser.mainLoop.method = "rAF"
  }
  return 0
}

function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
  Module["noExitRuntime"] = true;
  assert(!Browser.mainLoop.func, "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");
  Browser.mainLoop.func = func;
  Browser.mainLoop.arg = arg;
  var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
  Browser.mainLoop.runner = function Browser_mainLoop_runner() {
    if (ABORT) return;
    if (Browser.mainLoop.queue.length > 0) {
      var start = Date.now();
      var blocker = Browser.mainLoop.queue.shift();
      blocker.func(blocker.arg);
      if (Browser.mainLoop.remainingBlockers) {
        var remaining = Browser.mainLoop.remainingBlockers;
        var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
        if (blocker.counted) {
          Browser.mainLoop.remainingBlockers = next
        } else {
          next = next + .5;
          Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9
        }
      }
      console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + " ms");
      Browser.mainLoop.updateStatus();
      setTimeout(Browser.mainLoop.runner, 0);
      return
    }
    if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
    Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
    if (Browser.mainLoop.timingMode == 1 && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
      Browser.mainLoop.scheduler();
      return
    }
    if (Browser.mainLoop.method === "timeout" && Module.ctx) {
      Module.printErr("Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!");
      Browser.mainLoop.method = ""
    }
    Browser.mainLoop.runIter((function() {
      if (typeof arg !== "undefined") {
        Runtime.dynCall("vi", func, [arg])
      } else {
        Runtime.dynCall("v", func)
      }
    }));
    if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
    if (typeof SDL === "object" && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
    Browser.mainLoop.scheduler()
  };
  if (!noSetTiming) {
    if (fps && fps > 0) _emscripten_set_main_loop_timing(0, 1e3 / fps);
    else _emscripten_set_main_loop_timing(1, 1);
    Browser.mainLoop.scheduler()
  }
  if (simulateInfiniteLoop) {
    throw "SimulateInfiniteLoop"
  }
}
var Browser = {
  mainLoop: {
    scheduler: null,
    method: "",
    currentlyRunningMainloop: 0,
    func: null,
    arg: 0,
    timingMode: 0,
    timingValue: 0,
    currentFrameNumber: 0,
    queue: [],
    pause: (function() {
      Browser.mainLoop.scheduler = null;
      Browser.mainLoop.currentlyRunningMainloop++
    }),
    resume: (function() {
      Browser.mainLoop.currentlyRunningMainloop++;
      var timingMode = Browser.mainLoop.timingMode;
      var timingValue = Browser.mainLoop.timingValue;
      var func = Browser.mainLoop.func;
      Browser.mainLoop.func = null;
      _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true);
      _emscripten_set_main_loop_timing(timingMode, timingValue);
      Browser.mainLoop.scheduler()
    }),
    updateStatus: (function() {
      if (Module["setStatus"]) {
        var message = Module["statusMessage"] || "Please wait...";
        var remaining = Browser.mainLoop.remainingBlockers;
        var expected = Browser.mainLoop.expectedBlockers;
        if (remaining) {
          if (remaining < expected) {
            Module["setStatus"](message + " (" + (expected - remaining) + "/" + expected + ")")
          } else {
            Module["setStatus"](message)
          }
        } else {
          Module["setStatus"]("")
        }
      }
    }),
    runIter: (function(func) {
      if (ABORT) return;
      if (Module["preMainLoop"]) {
        var preRet = Module["preMainLoop"]();
        if (preRet === false) {
          return
        }
      }
      try {
        func()
      } catch (e) {
        if (e instanceof ExitStatus) {
          return
        } else {
          if (e && typeof e === "object" && e.stack) Module.printErr("exception thrown: " + [e, e.stack]);
          throw e
        }
      }
      if (Module["postMainLoop"]) Module["postMainLoop"]()
    })
  },
  isFullScreen: false,
  pointerLock: false,
  moduleContextCreatedCallbacks: [],
  workers: [],
  init: (function() {
    if (!Module["preloadPlugins"]) Module["preloadPlugins"] = [];
    if (Browser.initted) return;
    Browser.initted = true;
    try {
      new Blob;
      Browser.hasBlobConstructor = true
    } catch (e) {
      Browser.hasBlobConstructor = false;
      console.log("warning: no blob constructor, cannot create blobs with mimetypes")
    }
    Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : !Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null;
    Browser.URLObject = typeof window != "undefined" ? window.URL ? window.URL : window.webkitURL : undefined;
    if (!Module.noImageDecoding && typeof Browser.URLObject === "undefined") {
      console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
      Module.noImageDecoding = true
    }
    var imagePlugin = {};
    imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
      return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name)
    };
    imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
      var b = null;
      if (Browser.hasBlobConstructor) {
        try {
          b = new Blob([byteArray], {
            type: Browser.getMimetype(name)
          });
          if (b.size !== byteArray.length) {
            b = new Blob([(new Uint8Array(byteArray)).buffer], {
              type: Browser.getMimetype(name)
            })
          }
        } catch (e) {
          Runtime.warnOnce("Blob constructor present but fails: " + e + "; falling back to blob builder")
        }
      }
      if (!b) {
        var bb = new Browser.BlobBuilder;
        bb.append((new Uint8Array(byteArray)).buffer);
        b = bb.getBlob()
      }
      var url = Browser.URLObject.createObjectURL(b);
      var img = new Image;
      img.onload = function img_onload() {
        assert(img.complete, "Image " + name + " could not be decoded");
        var canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        Module["preloadedImages"][name] = canvas;
        Browser.URLObject.revokeObjectURL(url);
        if (onload) onload(byteArray)
      };
      img.onerror = function img_onerror(event) {
        console.log("Image " + url + " could not be decoded");
        if (onerror) onerror()
      };
      img.src = url
    };
    Module["preloadPlugins"].push(imagePlugin);
    var audioPlugin = {};
    audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
      return !Module.noAudioDecoding && name.substr(-4) in {
        ".ogg": 1,
        ".wav": 1,
        ".mp3": 1
      }
    };
    audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
      var done = false;

      function finish(audio) {
        if (done) return;
        done = true;
        Module["preloadedAudios"][name] = audio;
        if (onload) onload(byteArray)
      }

      function fail() {
        if (done) return;
        done = true;
        Module["preloadedAudios"][name] = new Audio;
        if (onerror) onerror()
      }
      if (Browser.hasBlobConstructor) {
        try {
          var b = new Blob([byteArray], {
            type: Browser.getMimetype(name)
          })
        } catch (e) {
          return fail()
        }
        var url = Browser.URLObject.createObjectURL(b);
        var audio = new Audio;
        audio.addEventListener("canplaythrough", (function() {
          finish(audio)
        }), false);
        audio.onerror = function audio_onerror(event) {
          if (done) return;
          console.log("warning: browser could not fully decode audio " + name + ", trying slower base64 approach");

          function encode64(data) {
            var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            var PAD = "=";
            var ret = "";
            var leftchar = 0;
            var leftbits = 0;
            for (var i = 0; i < data.length; i++) {
              leftchar = leftchar << 8 | data[i];
              leftbits += 8;
              while (leftbits >= 6) {
                var curr = leftchar >> leftbits - 6 & 63;
                leftbits -= 6;
                ret += BASE[curr]
              }
            }
            if (leftbits == 2) {
              ret += BASE[(leftchar & 3) << 4];
              ret += PAD + PAD
            } else if (leftbits == 4) {
              ret += BASE[(leftchar & 15) << 2];
              ret += PAD
            }
            return ret
          }
          audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
          finish(audio)
        };
        audio.src = url;
        Browser.safeSetTimeout((function() {
          finish(audio)
        }), 1e4)
      } else {
        return fail()
      }
    };
    Module["preloadPlugins"].push(audioPlugin);
    var canvas = Module["canvas"];

    function pointerLockChange() {
      Browser.pointerLock = document["pointerLockElement"] === canvas || document["mozPointerLockElement"] === canvas || document["webkitPointerLockElement"] === canvas || document["msPointerLockElement"] === canvas
    }
    if (canvas) {
      canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || (function() {});
      canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || (function() {});
      canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
      document.addEventListener("pointerlockchange", pointerLockChange, false);
      document.addEventListener("mozpointerlockchange", pointerLockChange, false);
      document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
      document.addEventListener("mspointerlockchange", pointerLockChange, false);
      if (Module["elementPointerLock"]) {
        canvas.addEventListener("click", (function(ev) {
          if (!Browser.pointerLock && canvas.requestPointerLock) {
            canvas.requestPointerLock();
            ev.preventDefault()
          }
        }), false)
      }
    }
  }),
  createContext: (function(canvas, useWebGL, setInModule, webGLContextAttributes) {
    if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx;
    var ctx;
    var contextHandle;
    if (useWebGL) {
      var contextAttributes = {
        antialias: false,
        alpha: false
      };
      if (webGLContextAttributes) {
        for (var attribute in webGLContextAttributes) {
          contextAttributes[attribute] = webGLContextAttributes[attribute]
        }
      }
      contextHandle = GL.createContext(canvas, contextAttributes);
      if (contextHandle) {
        ctx = GL.getContext(contextHandle).GLctx
      }
      canvas.style.backgroundColor = "black"
    } else {
      ctx = canvas.getContext("2d")
    }
    if (!ctx) return null;
    if (setInModule) {
      if (!useWebGL) assert(typeof GLctx === "undefined", "cannot set in module if GLctx is used, but we are a non-GL context that would replace it");
      Module.ctx = ctx;
      if (useWebGL) GL.makeContextCurrent(contextHandle);
      Module.useWebGL = useWebGL;
      Browser.moduleContextCreatedCallbacks.forEach((function(callback) {
        callback()
      }));
      Browser.init()
    }
    return ctx
  }),
  destroyContext: (function(canvas, useWebGL, setInModule) {}),
  fullScreenHandlersInstalled: false,
  lockPointer: undefined,
  resizeCanvas: undefined,
  requestFullScreen: (function(lockPointer, resizeCanvas, vrDevice) {
    Browser.lockPointer = lockPointer;
    Browser.resizeCanvas = resizeCanvas;
    Browser.vrDevice = vrDevice;
    if (typeof Browser.lockPointer === "undefined") Browser.lockPointer = true;
    if (typeof Browser.resizeCanvas === "undefined") Browser.resizeCanvas = false;
    if (typeof Browser.vrDevice === "undefined") Browser.vrDevice = null;
    var canvas = Module["canvas"];

    function fullScreenChange() {
      Browser.isFullScreen = false;
      var canvasContainer = canvas.parentNode;
      if ((document["webkitFullScreenElement"] || document["webkitFullscreenElement"] || document["mozFullScreenElement"] || document["mozFullscreenElement"] || document["fullScreenElement"] || document["fullscreenElement"] || document["msFullScreenElement"] || document["msFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
        canvas.cancelFullScreen = document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["webkitCancelFullScreen"] || document["msExitFullscreen"] || document["exitFullscreen"] || (function() {});
        canvas.cancelFullScreen = canvas.cancelFullScreen.bind(document);
        if (Browser.lockPointer) canvas.requestPointerLock();
        Browser.isFullScreen = true;
        if (Browser.resizeCanvas) Browser.setFullScreenCanvasSize()
      } else {
        canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
        canvasContainer.parentNode.removeChild(canvasContainer);
        if (Browser.resizeCanvas) Browser.setWindowedCanvasSize()
      }
      if (Module["onFullScreen"]) Module["onFullScreen"](Browser.isFullScreen);
      Browser.updateCanvasDimensions(canvas)
    }
    if (!Browser.fullScreenHandlersInstalled) {
      Browser.fullScreenHandlersInstalled = true;
      document.addEventListener("fullscreenchange", fullScreenChange, false);
      document.addEventListener("mozfullscreenchange", fullScreenChange, false);
      document.addEventListener("webkitfullscreenchange", fullScreenChange, false);
      document.addEventListener("MSFullscreenChange", fullScreenChange, false)
    }
    var canvasContainer = document.createElement("div");
    canvas.parentNode.insertBefore(canvasContainer, canvas);
    canvasContainer.appendChild(canvas);
    canvasContainer.requestFullScreen = canvasContainer["requestFullScreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullScreen"] ? (function() {
      canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"])
    }) : null);
    if (vrDevice) {
      canvasContainer.requestFullScreen({
        vrDisplay: vrDevice
      })
    } else {
      canvasContainer.requestFullScreen()
    }
  }),
  nextRAF: 0,
  fakeRequestAnimationFrame: (function(func) {
    var now = Date.now();
    if (Browser.nextRAF === 0) {
      Browser.nextRAF = now + 1e3 / 60
    } else {
      while (now + 2 >= Browser.nextRAF) {
        Browser.nextRAF += 1e3 / 60
      }
    }
    var delay = Math.max(Browser.nextRAF - now, 0);
    setTimeout(func, delay)
  }),
  requestAnimationFrame: function requestAnimationFrame(func) {
    if (typeof window === "undefined") {
      Browser.fakeRequestAnimationFrame(func)
    } else {
      if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = window["requestAnimationFrame"] || window["mozRequestAnimationFrame"] || window["webkitRequestAnimationFrame"] || window["msRequestAnimationFrame"] || window["oRequestAnimationFrame"] || Browser.fakeRequestAnimationFrame
      }
      window.requestAnimationFrame(func)
    }
  },
  safeCallback: (function(func) {
    return (function() {
      if (!ABORT) return func.apply(null, arguments)
    })
  }),
  allowAsyncCallbacks: true,
  queuedAsyncCallbacks: [],
  pauseAsyncCallbacks: (function() {
    Browser.allowAsyncCallbacks = false
  }),
  resumeAsyncCallbacks: (function() {
    Browser.allowAsyncCallbacks = true;
    if (Browser.queuedAsyncCallbacks.length > 0) {
      var callbacks = Browser.queuedAsyncCallbacks;
      Browser.queuedAsyncCallbacks = [];
      callbacks.forEach((function(func) {
        func()
      }))
    }
  }),
  safeRequestAnimationFrame: (function(func) {
    return Browser.requestAnimationFrame((function() {
      if (ABORT) return;
      if (Browser.allowAsyncCallbacks) {
        func()
      } else {
        Browser.queuedAsyncCallbacks.push(func)
      }
    }))
  }),
  safeSetTimeout: (function(func, timeout) {
    Module["noExitRuntime"] = true;
    return setTimeout((function() {
      if (ABORT) return;
      if (Browser.allowAsyncCallbacks) {
        func()
      } else {
        Browser.queuedAsyncCallbacks.push(func)
      }
    }), timeout)
  }),
  safeSetInterval: (function(func, timeout) {
    Module["noExitRuntime"] = true;
    return setInterval((function() {
      if (ABORT) return;
      if (Browser.allowAsyncCallbacks) {
        func()
      }
    }), timeout)
  }),
  getMimetype: (function(name) {
    return {
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "png": "image/png",
      "bmp": "image/bmp",
      "ogg": "audio/ogg",
      "wav": "audio/wav",
      "mp3": "audio/mpeg"
    }[name.substr(name.lastIndexOf(".") + 1)]
  }),
  getUserMedia: (function(func) {
    if (!window.getUserMedia) {
      window.getUserMedia = navigator["getUserMedia"] || navigator["mozGetUserMedia"]
    }
    window.getUserMedia(func)
  }),
  getMovementX: (function(event) {
    return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0
  }),
  getMovementY: (function(event) {
    return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0
  }),
  getMouseWheelDelta: (function(event) {
    var delta = 0;
    switch (event.type) {
      case "DOMMouseScroll":
        delta = event.detail;
        break;
      case "mousewheel":
        delta = event.wheelDelta;
        break;
      case "wheel":
        delta = event["deltaY"];
        break;
      default:
        throw "unrecognized mouse wheel event: " + event.type
    }
    return delta
  }),
  mouseX: 0,
  mouseY: 0,
  mouseMovementX: 0,
  mouseMovementY: 0,
  touches: {},
  lastTouches: {},
  calculateMouseEvent: (function(event) {
    if (Browser.pointerLock) {
      if (event.type != "mousemove" && "mozMovementX" in event) {
        Browser.mouseMovementX = Browser.mouseMovementY = 0
      } else {
        Browser.mouseMovementX = Browser.getMovementX(event);
        Browser.mouseMovementY = Browser.getMovementY(event)
      }
      if (typeof SDL != "undefined") {
        Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
        Browser.mouseY = SDL.mouseY + Browser.mouseMovementY
      } else {
        Browser.mouseX += Browser.mouseMovementX;
        Browser.mouseY += Browser.mouseMovementY
      }
    } else {
      var rect = Module["canvas"].getBoundingClientRect();
      var cw = Module["canvas"].width;
      var ch = Module["canvas"].height;
      var scrollX = typeof window.scrollX !== "undefined" ? window.scrollX : window.pageXOffset;
      var scrollY = typeof window.scrollY !== "undefined" ? window.scrollY : window.pageYOffset;
      if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
        var touch = event.touch;
        if (touch === undefined) {
          return
        }
        var adjustedX = touch.pageX - (scrollX + rect.left);
        var adjustedY = touch.pageY - (scrollY + rect.top);
        adjustedX = adjustedX * (cw / rect.width);
        adjustedY = adjustedY * (ch / rect.height);
        var coords = {
          x: adjustedX,
          y: adjustedY
        };
        if (event.type === "touchstart") {
          Browser.lastTouches[touch.identifier] = coords;
          Browser.touches[touch.identifier] = coords
        } else if (event.type === "touchend" || event.type === "touchmove") {
          var last = Browser.touches[touch.identifier];
          if (!last) last = coords;
          Browser.lastTouches[touch.identifier] = last;
          Browser.touches[touch.identifier] = coords
        }
        return
      }
      var x = event.pageX - (scrollX + rect.left);
      var y = event.pageY - (scrollY + rect.top);
      x = x * (cw / rect.width);
      y = y * (ch / rect.height);
      Browser.mouseMovementX = x - Browser.mouseX;
      Browser.mouseMovementY = y - Browser.mouseY;
      Browser.mouseX = x;
      Browser.mouseY = y
    }
  }),
  xhrLoad: (function(url, onload, onerror) {
    var xhr = new XMLHttpRequest;
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
        onload(xhr.response)
      } else {
        onerror()
      }
    };
    xhr.onerror = onerror;
    xhr.send(null)
  }),
  asyncLoad: (function(url, onload, onerror, noRunDep) {
    Browser.xhrLoad(url, (function(arrayBuffer) {
      assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
      onload(new Uint8Array(arrayBuffer));
      if (!noRunDep) removeRunDependency("al " + url)
    }), (function(event) {
      if (onerror) {
        onerror()
      } else {
        throw 'Loading data file "' + url + '" failed.'
      }
    }));
    if (!noRunDep) addRunDependency("al " + url)
  }),
  resizeListeners: [],
  updateResizeListeners: (function() {
    var canvas = Module["canvas"];
    Browser.resizeListeners.forEach((function(listener) {
      listener(canvas.width, canvas.height)
    }))
  }),
  setCanvasSize: (function(width, height, noUpdates) {
    var canvas = Module["canvas"];
    Browser.updateCanvasDimensions(canvas, width, height);
    if (!noUpdates) Browser.updateResizeListeners()
  }),
  windowedWidth: 0,
  windowedHeight: 0,
  setFullScreenCanvasSize: (function() {
    if (typeof SDL != "undefined") {
      var flags = HEAPU32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2];
      flags = flags | 8388608;
      HEAP32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2] = flags
    }
    Browser.updateResizeListeners()
  }),
  setWindowedCanvasSize: (function() {
    if (typeof SDL != "undefined") {
      var flags = HEAPU32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2];
      flags = flags & ~8388608;
      HEAP32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2] = flags
    }
    Browser.updateResizeListeners()
  }),
  updateCanvasDimensions: (function(canvas, wNative, hNative) {
    if (wNative && hNative) {
      canvas.widthNative = wNative;
      canvas.heightNative = hNative
    } else {
      wNative = canvas.widthNative;
      hNative = canvas.heightNative
    }
    var w = wNative;
    var h = hNative;
    if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
      if (w / h < Module["forcedAspectRatio"]) {
        w = Math.round(h * Module["forcedAspectRatio"])
      } else {
        h = Math.round(w / Module["forcedAspectRatio"])
      }
    }
    if ((document["webkitFullScreenElement"] || document["webkitFullscreenElement"] || document["mozFullScreenElement"] || document["mozFullscreenElement"] || document["fullScreenElement"] || document["fullscreenElement"] || document["msFullScreenElement"] || document["msFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode && typeof screen != "undefined") {
      var factor = Math.min(screen.width / w, screen.height / h);
      w = Math.round(w * factor);
      h = Math.round(h * factor)
    }
    if (Browser.resizeCanvas) {
      if (canvas.width != w) canvas.width = w;
      if (canvas.height != h) canvas.height = h;
      if (typeof canvas.style != "undefined") {
        canvas.style.removeProperty("width");
        canvas.style.removeProperty("height")
      }
    } else {
      if (canvas.width != wNative) canvas.width = wNative;
      if (canvas.height != hNative) canvas.height = hNative;
      if (typeof canvas.style != "undefined") {
        if (w != wNative || h != hNative) {
          canvas.style.setProperty("width", w + "px", "important");
          canvas.style.setProperty("height", h + "px", "important")
        } else {
          canvas.style.removeProperty("width");
          canvas.style.removeProperty("height")
        }
      }
    }
  }),
  wgetRequests: {},
  nextWgetRequestHandle: 0,
  getNextWgetRequestHandle: (function() {
    var handle = Browser.nextWgetRequestHandle;
    Browser.nextWgetRequestHandle++;
    return handle
  })
};
Module["_bitshift64Lshr"] = _bitshift64Lshr;

function _recv(fd, buf, len, flags) {
  var sock = SOCKFS.getSocket(fd);
  if (!sock) {
    ___setErrNo(ERRNO_CODES.EBADF);
    return -1
  }
  return _read(fd, buf, len)
}

function _pread(fildes, buf, nbyte, offset) {
  var stream = FS.getStream(fildes);
  if (!stream) {
    ___setErrNo(ERRNO_CODES.EBADF);
    return -1
  }
  try {
    var slab = HEAP8;
    return FS.read(stream, slab, buf, nbyte, offset)
  } catch (e) {
    FS.handleFSError(e);
    return -1
  }
}

function _read(fildes, buf, nbyte) {
  var stream = FS.getStream(fildes);
  if (!stream) {
    ___setErrNo(ERRNO_CODES.EBADF);
    return -1
  }
  try {
    var slab = HEAP8;
    return FS.read(stream, slab, buf, nbyte)
  } catch (e) {
    FS.handleFSError(e);
    return -1
  }
}

function _fread(ptr, size, nitems, stream) {
  var bytesToRead = nitems * size;
  if (bytesToRead == 0) {
    return 0
  }
  var bytesRead = 0;
  var streamObj = FS.getStreamFromPtr(stream);
  if (!streamObj) {
    ___setErrNo(ERRNO_CODES.EBADF);
    return 0
  }
  while (streamObj.ungotten.length && bytesToRead > 0) {
    HEAP8[ptr++ >> 0] = streamObj.ungotten.pop();
    bytesToRead--;
    bytesRead++
  }
  var err = _read(streamObj.fd, ptr, bytesToRead);
  if (err == -1) {
    if (streamObj) streamObj.error = true;
    return 0
  }
  bytesRead += err;
  if (bytesRead < bytesToRead) streamObj.eof = true;
  return bytesRead / size | 0
}

function _ftell(stream) {
  stream = FS.getStreamFromPtr(stream);
  if (!stream) {
    ___setErrNo(ERRNO_CODES.EBADF);
    return -1
  }
  if (FS.isChrdev(stream.node.mode)) {
    ___setErrNo(ERRNO_CODES.ESPIPE);
    return -1
  } else {
    return stream.position
  }
}

function _ftello() {
  return _ftell.apply(null, arguments)
}
var _BDtoIHigh = true;
var PTHREAD_SPECIFIC = {};
var PTHREAD_SPECIFIC_NEXT_KEY = 1;

function _pthread_key_create(key, destructor) {
  if (key == 0) {
    return ERRNO_CODES.EINVAL
  }
  HEAP32[key >> 2] = PTHREAD_SPECIFIC_NEXT_KEY;
  PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
  PTHREAD_SPECIFIC_NEXT_KEY++;
  return 0
}
var _ceil = Math_ceil;

function __isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function __arraySum(array, index) {
  var sum = 0;
  for (var i = 0; i <= index; sum += array[i++]);
  return sum
}
var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function __addDays(date, days) {
  var newDate = new Date(date.getTime());
  while (days > 0) {
    var leap = __isLeapYear(newDate.getFullYear());
    var currentMonth = newDate.getMonth();
    var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
    if (days > daysInCurrentMonth - newDate.getDate()) {
      days -= daysInCurrentMonth - newDate.getDate() + 1;
      newDate.setDate(1);
      if (currentMonth < 11) {
        newDate.setMonth(currentMonth + 1)
      } else {
        newDate.setMonth(0);
        newDate.setFullYear(newDate.getFullYear() + 1)
      }
    } else {
      newDate.setDate(newDate.getDate() + days);
      return newDate
    }
  }
  return newDate
}

function _strftime(s, maxsize, format, tm) {
  var tm_zone = HEAP32[tm + 40 >> 2];
  var date = {
    tm_sec: HEAP32[tm >> 2],
    tm_min: HEAP32[tm + 4 >> 2],
    tm_hour: HEAP32[tm + 8 >> 2],
    tm_mday: HEAP32[tm + 12 >> 2],
    tm_mon: HEAP32[tm + 16 >> 2],
    tm_year: HEAP32[tm + 20 >> 2],
    tm_wday: HEAP32[tm + 24 >> 2],
    tm_yday: HEAP32[tm + 28 >> 2],
    tm_isdst: HEAP32[tm + 32 >> 2],
    tm_gmtoff: HEAP32[tm + 36 >> 2],
    tm_zone: tm_zone ? Pointer_stringify(tm_zone) : ""
  };
  var pattern = Pointer_stringify(format);
  var EXPANSION_RULES_1 = {
    "%c": "%a %b %d %H:%M:%S %Y",
    "%D": "%m/%d/%y",
    "%F": "%Y-%m-%d",
    "%h": "%b",
    "%r": "%I:%M:%S %p",
    "%R": "%H:%M",
    "%T": "%H:%M:%S",
    "%x": "%m/%d/%y",
    "%X": "%H:%M:%S"
  };
  for (var rule in EXPANSION_RULES_1) {
    pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_1[rule])
  }
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function leadingSomething(value, digits, character) {
    var str = typeof value === "number" ? value.toString() : value || "";
    while (str.length < digits) {
      str = character[0] + str
    }
    return str
  }

  function leadingNulls(value, digits) {
    return leadingSomething(value, digits, "0")
  }

  function compareByDay(date1, date2) {
    function sgn(value) {
      return value < 0 ? -1 : value > 0 ? 1 : 0
    }
    var compare;
    if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
      if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
        compare = sgn(date1.getDate() - date2.getDate())
      }
    }
    return compare
  }

  function getFirstWeekStartDate(janFourth) {
    switch (janFourth.getDay()) {
      case 0:
        return new Date(janFourth.getFullYear() - 1, 11, 29);
      case 1:
        return janFourth;
      case 2:
        return new Date(janFourth.getFullYear(), 0, 3);
      case 3:
        return new Date(janFourth.getFullYear(), 0, 2);
      case 4:
        return new Date(janFourth.getFullYear(), 0, 1);
      case 5:
        return new Date(janFourth.getFullYear() - 1, 11, 31);
      case 6:
        return new Date(janFourth.getFullYear() - 1, 11, 30)
    }
  }

  function getWeekBasedYear(date) {
    var thisDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
    var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
    var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
    var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
    var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
    if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
      if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
        return thisDate.getFullYear() + 1
      } else {
        return thisDate.getFullYear()
      }
    } else {
      return thisDate.getFullYear() - 1
    }
  }
  var EXPANSION_RULES_2 = {
    "%a": (function(date) {
      return WEEKDAYS[date.tm_wday].substring(0, 3)
    }),
    "%A": (function(date) {
      return WEEKDAYS[date.tm_wday]
    }),
    "%b": (function(date) {
      return MONTHS[date.tm_mon].substring(0, 3)
    }),
    "%B": (function(date) {
      return MONTHS[date.tm_mon]
    }),
    "%C": (function(date) {
      var year = date.tm_year + 1900;
      return leadingNulls(year / 100 | 0, 2)
    }),
    "%d": (function(date) {
      return leadingNulls(date.tm_mday, 2)
    }),
    "%e": (function(date) {
      return leadingSomething(date.tm_mday, 2, " ")
    }),
    "%g": (function(date) {
      return getWeekBasedYear(date).toString().substring(2)
    }),
    "%G": (function(date) {
      return getWeekBasedYear(date)
    }),
    "%H": (function(date) {
      return leadingNulls(date.tm_hour, 2)
    }),
    "%I": (function(date) {
      return leadingNulls(date.tm_hour < 13 ? date.tm_hour : date.tm_hour - 12, 2)
    }),
    "%j": (function(date) {
      return leadingNulls(date.tm_mday + __arraySum(__isLeapYear(date.tm_year + 1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date.tm_mon - 1), 3)
    }),
    "%m": (function(date) {
      return leadingNulls(date.tm_mon + 1, 2)
    }),
    "%M": (function(date) {
      return leadingNulls(date.tm_min, 2)
    }),
    "%n": (function() {
      return "\n"
    }),
    "%p": (function(date) {
      if (date.tm_hour > 0 && date.tm_hour < 13) {
        return "AM"
      } else {
        return "PM"
      }
    }),
    "%S": (function(date) {
      return leadingNulls(date.tm_sec, 2)
    }),
    "%t": (function() {
      return "\t"
    }),
    "%u": (function(date) {
      var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);
      return day.getDay() || 7
    }),
    "%U": (function(date) {
      var janFirst = new Date(date.tm_year + 1900, 0, 1);
      var firstSunday = janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7 - janFirst.getDay());
      var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
      if (compareByDay(firstSunday, endDate) < 0) {
        var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
        var firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
        var days = firstSundayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
        return leadingNulls(Math.ceil(days / 7), 2)
      }
      return compareByDay(firstSunday, janFirst) === 0 ? "01" : "00"
    }),
    "%V": (function(date) {
      var janFourthThisYear = new Date(date.tm_year + 1900, 0, 4);
      var janFourthNextYear = new Date(date.tm_year + 1901, 0, 4);
      var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
      var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
      var endDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
      if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
        return "53"
      }
      if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
        return "01"
      }
      var daysDifference;
      if (firstWeekStartThisYear.getFullYear() < date.tm_year + 1900) {
        daysDifference = date.tm_yday + 32 - firstWeekStartThisYear.getDate()
      } else {
        daysDifference = date.tm_yday + 1 - firstWeekStartThisYear.getDate()
      }
      return leadingNulls(Math.ceil(daysDifference / 7), 2)
    }),
    "%w": (function(date) {
      var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);
      return day.getDay()
    }),
    "%W": (function(date) {
      var janFirst = new Date(date.tm_year, 0, 1);
      var firstMonday = janFirst.getDay() === 1 ? janFirst : __addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1);
      var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
      if (compareByDay(firstMonday, endDate) < 0) {
        var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
        var firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
        var days = firstMondayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
        return leadingNulls(Math.ceil(days / 7), 2)
      }
      return compareByDay(firstMonday, janFirst) === 0 ? "01" : "00"
    }),
    "%y": (function(date) {
      return (date.tm_year + 1900).toString().substring(2)
    }),
    "%Y": (function(date) {
      return date.tm_year + 1900
    }),
    "%z": (function(date) {
      var off = date.tm_gmtoff;
      var ahead = off >= 0;
      off = Math.abs(off) / 60;
      off = off / 60 * 100 + off % 60;
      return (ahead ? "+" : "-") + String("0000" + off).slice(-4)
    }),
    "%Z": (function(date) {
      return date.tm_zone
    }),
    "%%": (function() {
      return "%"
    })
  };
  for (var rule in EXPANSION_RULES_2) {
    if (pattern.indexOf(rule) >= 0) {
      pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_2[rule](date))
    }
  }
  var bytes = intArrayFromString(pattern, false);
  if (bytes.length > maxsize) {
    return 0
  }
  writeArrayToMemory(bytes, s);
  return bytes.length - 1
}

function _strftime_l(s, maxsize, format, tm) {
  return _strftime(s, maxsize, format, tm)
}
Module["_strlen"] = _strlen;

function __reallyNegative(x) {
  return x < 0 || x === 0 && 1 / x === -Infinity
}

function __formatString(format, varargs) {
  assert((varargs & 7) === 0);
  var textIndex = format;
  var argIndex = 0;

  function getNextArg(type) {
    var ret;
    argIndex = Runtime.prepVararg(argIndex, type);
    if (type === "double") {
      ret = (HEAP32[tempDoublePtr >> 2] = HEAP32[varargs + argIndex >> 2], HEAP32[tempDoublePtr + 4 >> 2] = HEAP32[varargs + (argIndex + 4) >> 2], +HEAPF64[tempDoublePtr >> 3]);
      argIndex += 8
    } else if (type == "i64") {
      ret = [HEAP32[varargs + argIndex >> 2], HEAP32[varargs + (argIndex + 4) >> 2]];
      argIndex += 8
    } else {
      assert((argIndex & 3) === 0);
      type = "i32";
      ret = HEAP32[varargs + argIndex >> 2];
      argIndex += 4
    }
    return ret
  }
  var ret = [];
  var curr, next, currArg;
  while (1) {
    var startTextIndex = textIndex;
    curr = HEAP8[textIndex >> 0];
    if (curr === 0) break;
    next = HEAP8[textIndex + 1 >> 0];
    if (curr == 37) {
      var flagAlwaysSigned = false;
      var flagLeftAlign = false;
      var flagAlternative = false;
      var flagZeroPad = false;
      var flagPadSign = false;
      flagsLoop: while (1) {
        switch (next) {
          case 43:
            flagAlwaysSigned = true;
            break;
          case 45:
            flagLeftAlign = true;
            break;
          case 35:
            flagAlternative = true;
            break;
          case 48:
            if (flagZeroPad) {
              break flagsLoop
            } else {
              flagZeroPad = true;
              break
            };
          case 32:
            flagPadSign = true;
            break;
          default:
            break flagsLoop
        }
        textIndex++;
        next = HEAP8[textIndex + 1 >> 0]
      }
      var width = 0;
      if (next == 42) {
        width = getNextArg("i32");
        textIndex++;
        next = HEAP8[textIndex + 1 >> 0]
      } else {
        while (next >= 48 && next <= 57) {
          width = width * 10 + (next - 48);
          textIndex++;
          next = HEAP8[textIndex + 1 >> 0]
        }
      }
      var precisionSet = false,
        precision = -1;
      if (next == 46) {
        precision = 0;
        precisionSet = true;
        textIndex++;
        next = HEAP8[textIndex + 1 >> 0];
        if (next == 42) {
          precision = getNextArg("i32");
          textIndex++
        } else {
          while (1) {
            var precisionChr = HEAP8[textIndex + 1 >> 0];
            if (precisionChr < 48 || precisionChr > 57) break;
            precision = precision * 10 + (precisionChr - 48);
            textIndex++
          }
        }
        next = HEAP8[textIndex + 1 >> 0]
      }
      if (precision < 0) {
        precision = 6;
        precisionSet = false
      }
      var argSize;
      switch (String.fromCharCode(next)) {
        case "h":
          var nextNext = HEAP8[textIndex + 2 >> 0];
          if (nextNext == 104) {
            textIndex++;
            argSize = 1
          } else {
            argSize = 2
          }
          break;
        case "l":
          var nextNext = HEAP8[textIndex + 2 >> 0];
          if (nextNext == 108) {
            textIndex++;
            argSize = 8
          } else {
            argSize = 4
          }
          break;
        case "L":
        case "q":
        case "j":
          argSize = 8;
          break;
        case "z":
        case "t":
        case "I":
          argSize = 4;
          break;
        default:
          argSize = null
      }
      if (argSize) textIndex++;
      next = HEAP8[textIndex + 1 >> 0];
      switch (String.fromCharCode(next)) {
        case "d":
        case "i":
        case "u":
        case "o":
        case "x":
        case "X":
        case "p":
          {
            var signed = next == 100 || next == 105;
            argSize = argSize || 4;
            var currArg = getNextArg("i" + argSize * 8);
            var origArg = currArg;
            var argText;
            if (argSize == 8) {
              currArg = Runtime.makeBigInt(currArg[0], currArg[1], next == 117)
            }
            if (argSize <= 4) {
              var limit = Math.pow(256, argSize) - 1;
              currArg = (signed ? reSign : unSign)(currArg & limit, argSize * 8)
            }
            var currAbsArg = Math.abs(currArg);
            var prefix = "";
            if (next == 100 || next == 105) {
              if (argSize == 8 && i64Math) argText = i64Math.stringify(origArg[0], origArg[1], null);
              else argText = reSign(currArg, 8 * argSize, 1).toString(10)
            } else if (next == 117) {
              if (argSize == 8 && i64Math) argText = i64Math.stringify(origArg[0], origArg[1], true);
              else argText = unSign(currArg, 8 * argSize, 1).toString(10);
              currArg = Math.abs(currArg)
            } else if (next == 111) {
              argText = (flagAlternative ? "0" : "") + currAbsArg.toString(8)
            } else if (next == 120 || next == 88) {
              prefix = flagAlternative && currArg != 0 ? "0x" : "";
              if (argSize == 8 && i64Math) {
                if (origArg[1]) {
                  argText = (origArg[1] >>> 0).toString(16);
                  var lower = (origArg[0] >>> 0).toString(16);
                  while (lower.length < 8) lower = "0" + lower;
                  argText += lower
                } else {
                  argText = (origArg[0] >>> 0).toString(16)
                }
              } else if (currArg < 0) {
                currArg = -currArg;
                argText = (currAbsArg - 1).toString(16);
                var buffer = [];
                for (var i = 0; i < argText.length; i++) {
                  buffer.push((15 - parseInt(argText[i], 16)).toString(16))
                }
                argText = buffer.join("");
                while (argText.length < argSize * 2) argText = "f" + argText
              } else {
                argText = currAbsArg.toString(16)
              }
              if (next == 88) {
                prefix = prefix.toUpperCase();
                argText = argText.toUpperCase()
              }
            } else if (next == 112) {
              if (currAbsArg === 0) {
                argText = "(nil)"
              } else {
                prefix = "0x";
                argText = currAbsArg.toString(16)
              }
            }
            if (precisionSet) {
              while (argText.length < precision) {
                argText = "0" + argText
              }
            }
            if (currArg >= 0) {
              if (flagAlwaysSigned) {
                prefix = "+" + prefix
              } else if (flagPadSign) {
                prefix = " " + prefix
              }
            }
            if (argText.charAt(0) == "-") {
              prefix = "-" + prefix;
              argText = argText.substr(1)
            }
            while (prefix.length + argText.length < width) {
              if (flagLeftAlign) {
                argText += " "
              } else {
                if (flagZeroPad) {
                  argText = "0" + argText
                } else {
                  prefix = " " + prefix
                }
              }
            }
            argText = prefix + argText;
            argText.split("").forEach((function(chr) {
              ret.push(chr.charCodeAt(0))
            }));
            break
          };
        case "f":
        case "F":
        case "e":
        case "E":
        case "g":
        case "G":
          {
            var currArg = getNextArg("double");
            var argText;
            if (isNaN(currArg)) {
              argText = "nan";
              flagZeroPad = false
            } else if (!isFinite(currArg)) {
              argText = (currArg < 0 ? "-" : "") + "inf";
              flagZeroPad = false
            } else {
              var isGeneral = false;
              var effectivePrecision = Math.min(precision, 20);
              if (next == 103 || next == 71) {
                isGeneral = true;
                precision = precision || 1;
                var exponent = parseInt(currArg.toExponential(effectivePrecision).split("e")[1], 10);
                if (precision > exponent && exponent >= -4) {
                  next = (next == 103 ? "f" : "F").charCodeAt(0);
                  precision -= exponent + 1
                } else {
                  next = (next == 103 ? "e" : "E").charCodeAt(0);
                  precision--
                }
                effectivePrecision = Math.min(precision, 20)
              }
              if (next == 101 || next == 69) {
                argText = currArg.toExponential(effectivePrecision);
                if (/[eE][-+]\d$/.test(argText)) {
                  argText = argText.slice(0, -1) + "0" + argText.slice(-1)
                }
              } else if (next == 102 || next == 70) {
                argText = currArg.toFixed(effectivePrecision);
                if (currArg === 0 && __reallyNegative(currArg)) {
                  argText = "-" + argText
                }
              }
              var parts = argText.split("e");
              if (isGeneral && !flagAlternative) {
                while (parts[0].length > 1 && parts[0].indexOf(".") != -1 && (parts[0].slice(-1) == "0" || parts[0].slice(-1) == ".")) {
                  parts[0] = parts[0].slice(0, -1)
                }
              } else {
                if (flagAlternative && argText.indexOf(".") == -1) parts[0] += ".";
                while (precision > effectivePrecision++) parts[0] += "0"
              }
              argText = parts[0] + (parts.length > 1 ? "e" + parts[1] : "");
              if (next == 69) argText = argText.toUpperCase();
              if (currArg >= 0) {
                if (flagAlwaysSigned) {
                  argText = "+" + argText
                } else if (flagPadSign) {
                  argText = " " + argText
                }
              }
            }
            while (argText.length < width) {
              if (flagLeftAlign) {
                argText += " "
              } else {
                if (flagZeroPad && (argText[0] == "-" || argText[0] == "+")) {
                  argText = argText[0] + "0" + argText.slice(1)
                } else {
                  argText = (flagZeroPad ? "0" : " ") + argText
                }
              }
            }
            if (next < 97) argText = argText.toUpperCase();
            argText.split("").forEach((function(chr) {
              ret.push(chr.charCodeAt(0))
            }));
            break
          };
        case "s":
          {
            var arg = getNextArg("i8*");
            var argLength = arg ? _strlen(arg) : "(null)".length;
            if (precisionSet) argLength = Math.min(argLength, precision);
            if (!flagLeftAlign) {
              while (argLength < width--) {
                ret.push(32)
              }
            }
            if (arg) {
              for (var i = 0; i < argLength; i++) {
                ret.push(HEAPU8[arg++ >> 0])
              }
            } else {
              ret = ret.concat(intArrayFromString("(null)".substr(0, argLength), true))
            }
            if (flagLeftAlign) {
              while (argLength < width--) {
                ret.push(32)
              }
            }
            break
          };
        case "c":
          {
            if (flagLeftAlign) ret.push(getNextArg("i8"));
            while (--width > 0) {
              ret.push(32)
            }
            if (!flagLeftAlign) ret.push(getNextArg("i8"));
            break
          };
        case "n":
          {
            var ptr = getNextArg("i32*");
            HEAP32[ptr >> 2] = ret.length;
            break
          };
        case "%":
          {
            ret.push(curr);
            break
          };
        default:
          {
            for (var i = startTextIndex; i < textIndex + 2; i++) {
              ret.push(HEAP8[i >> 0])
            }
          }
      }
      textIndex += 2
    } else {
      ret.push(curr);
      textIndex += 1
    }
  }
  return ret
}

function _fprintf(stream, format, varargs) {
  var result = __formatString(format, varargs);
  var stack = Runtime.stackSave();
  var ret = _fwrite(allocate(result, "i8", ALLOC_STACK), 1, result.length, stream);
  Runtime.stackRestore(stack);
  return ret
}

function _vfprintf(s, f, va_arg) {
  return _fprintf(s, f, HEAP32[va_arg >> 2])
}

function _pthread_mutex_unlock() {}

function _dlclose(handle) {
  if (!DLFCN.loadedLibs[handle]) {
    DLFCN.errorMsg = "Tried to dlclose() unopened handle: " + handle;
    return 1
  } else {
    var lib_record = DLFCN.loadedLibs[handle];
    if (--lib_record.refcount == 0) {
      if (lib_record.module.cleanups) {
        lib_record.module.cleanups.forEach((function(cleanup) {
          cleanup()
        }))
      }
      delete DLFCN.loadedLibNames[lib_record.name];
      delete DLFCN.loadedLibs[handle]
    }
    return 0
  }
}

function _emscripten_memcpy_big(dest, src, num) {
  HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
  return dest
}
Module["_memcpy"] = _memcpy;
var _emscripten_landingpad = true;

function _sbrk(bytes) {
  var self = _sbrk;
  if (!self.called) {
    DYNAMICTOP = alignMemoryPage(DYNAMICTOP);
    self.called = true;
    assert(Runtime.dynamicAlloc);
    self.alloc = Runtime.dynamicAlloc;
    Runtime.dynamicAlloc = (function() {
      abort("cannot dynamically allocate, sbrk now has control")
    })
  }
  var ret = DYNAMICTOP;
  if (bytes != 0) {
    var success = self.alloc(bytes);
    if (!success) return -1 >>> 0
  }
  return ret
}
Module["_memmove"] = _memmove;

function ___cxa_guard_abort() {}
var LOCALE = {
  curr: 0,
  check: (function(locale) {
    if (locale) locale = Pointer_stringify(locale);
    return locale === "C" || locale === "POSIX" || !locale
  })
};

function _calloc(n, s) {
  var ret = _malloc(n * s);
  _memset(ret, 0, n * s);
  return ret
}

function _newlocale(mask, locale, base) {
  if (!LOCALE.check(locale)) {
    ___setErrNo(ERRNO_CODES.ENOENT);
    return 0
  }
  if (!base) base = _calloc(1, 4);
  return base
}

function _localeconv() {
  var me = _localeconv;
  if (!me.ret) {
    me.ret = allocate([allocate(intArrayFromString("."), "i8", ALLOC_NORMAL), 0, 0, 0, allocate(intArrayFromString(""), "i8", ALLOC_NORMAL), 0, 0, 0, allocate(intArrayFromString(""), "i8", ALLOC_NORMAL), 0, 0, 0, allocate(intArrayFromString(""), "i8", ALLOC_NORMAL), 0, 0, 0, allocate(intArrayFromString(""), "i8", ALLOC_NORMAL), 0, 0, 0, allocate(intArrayFromString(""), "i8", ALLOC_NORMAL), 0, 0, 0, allocate(intArrayFromString(""), "i8", ALLOC_NORMAL), 0, 0, 0, allocate(intArrayFromString(""), "i8", ALLOC_NORMAL), 0, 0, 0, allocate(intArrayFromString(""), "i8", ALLOC_NORMAL), 0, 0, 0, allocate(intArrayFromString(""), "i8", ALLOC_NORMAL), 0, 0, 0], "i8*", ALLOC_NORMAL)
  }
  return me.ret
}
var _emscripten_preinvoke = true;

function ___gxx_personality_v0() {}

function _pthread_cond_wait() {
  return 0
}

function ___cxa_rethrow() {
  ___cxa_end_catch.rethrown = true;
  var ptr = EXCEPTIONS.caught.pop();
  EXCEPTIONS.last = ptr;
  throw ptr
}

function _opendir(dirname) {
  var path = Pointer_stringify(dirname);
  if (!path) {
    ___setErrNo(ERRNO_CODES.ENOENT);
    return 0
  }
  var node;
  try {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    node = lookup.node
  } catch (e) {
    FS.handleFSError(e);
    return 0
  }
  if (!FS.isDir(node.mode)) {
    ___setErrNo(ERRNO_CODES.ENOTDIR);
    return 0
  }
  var fd = _open(dirname, 0, allocate([0, 0, 0, 0], "i32", ALLOC_STACK));
  return fd === -1 ? 0 : FS.getPtrForStream(FS.getStream(fd))
}

function ___cxa_guard_release() {}

function _ungetc(c, stream) {
  stream = FS.getStreamFromPtr(stream);
  if (!stream) {
    return -1
  }
  if (c === -1) {
    return c
  }
  c = unSign(c & 255);
  stream.ungotten.push(c);
  stream.eof = false;
  return c
}

function _uselocale(locale) {
  var old = LOCALE.curr;
  if (locale) LOCALE.curr = locale;
  return old
}

function _sysconf(name) {
  switch (name) {
    case 30:
      return PAGE_SIZE;
    case 85:
      return totalMemory / PAGE_SIZE;
    case 132:
    case 133:
    case 12:
    case 137:
    case 138:
    case 15:
    case 235:
    case 16:
    case 17:
    case 18:
    case 19:
    case 20:
    case 149:
    case 13:
    case 10:
    case 236:
    case 153:
    case 9:
    case 21:
    case 22:
    case 159:
    case 154:
    case 14:
    case 77:
    case 78:
    case 139:
    case 80:
    case 81:
    case 82:
    case 68:
    case 67:
    case 164:
    case 11:
    case 29:
    case 47:
    case 48:
    case 95:
    case 52:
    case 51:
    case 46:
      return 200809;
    case 79:
      return 0;
    case 27:
    case 246:
    case 127:
    case 128:
    case 23:
    case 24:
    case 160:
    case 161:
    case 181:
    case 182:
    case 242:
    case 183:
    case 184:
    case 243:
    case 244:
    case 245:
    case 165:
    case 178:
    case 179:
    case 49:
    case 50:
    case 168:
    case 169:
    case 175:
    case 170:
    case 171:
    case 172:
    case 97:
    case 76:
    case 32:
    case 173:
    case 35:
      return -1;
    case 176:
    case 177:
    case 7:
    case 155:
    case 8:
    case 157:
    case 125:
    case 126:
    case 92:
    case 93:
    case 129:
    case 130:
    case 131:
    case 94:
    case 91:
      return 1;
    case 74:
    case 60:
    case 69:
    case 70:
    case 4:
      return 1024;
    case 31:
    case 42:
    case 72:
      return 32;
    case 87:
    case 26:
    case 33:
      return 2147483647;
    case 34:
    case 1:
      return 47839;
    case 38:
    case 36:
      return 99;
    case 43:
    case 37:
      return 2048;
    case 0:
      return 2097152;
    case 3:
      return 65536;
    case 28:
      return 32768;
    case 44:
      return 32767;
    case 75:
      return 16384;
    case 39:
      return 1e3;
    case 89:
      return 700;
    case 71:
      return 256;
    case 40:
      return 255;
    case 2:
      return 100;
    case 180:
      return 64;
    case 25:
      return 20;
    case 5:
      return 16;
    case 6:
      return 6;
    case 73:
      return 4;
    case 84:
      {
        if (typeof navigator === "object") return navigator["hardwareConcurrency"] || 1;
        return 1
      }
  }
  ___setErrNo(ERRNO_CODES.EINVAL);
  return -1
}

function _dlsym(handle, symbol) {
  symbol = Pointer_stringify(symbol);
  if (!DLFCN.loadedLibs[handle]) {
    DLFCN.errorMsg = "Tried to dlsym() from an unopened handle: " + handle;
    return 0
  } else {
    var lib = DLFCN.loadedLibs[handle];
    symbol = "_" + symbol;
    if (lib.cached_functions.hasOwnProperty(symbol)) {
      return lib.cached_functions[symbol]
    }
    if (!lib.module.hasOwnProperty(symbol)) {
      DLFCN.errorMsg = 'Tried to lookup unknown symbol "' + symbol + '" in dynamic lib: ' + lib.name;
      return 0
    } else {
      var result = lib.module[symbol];
      if (typeof result == "function") {
        result = Runtime.addFunction(result);
        lib.cached_functions = result
      }
      return result
    }
  }
}

function ___errno_location() {
  return ___errno_state
}
Module["_memset"] = _memset;
var _BDtoILow = true;
var _ceilf = Math_ceil;

function _readdir_r(dirp, entry, result) {
  var stream = FS.getStreamFromPtr(dirp);
  if (!stream) {
    return ___setErrNo(ERRNO_CODES.EBADF)
  }
  if (!stream.currReading) {
    try {
      stream.currReading = FS.readdir(stream.path)
    } catch (e) {
      return FS.handleFSError(e)
    }
  }
  if (stream.position < 0 || stream.position >= stream.currReading.length) {
    HEAP32[result >> 2] = 0;
    return 0
  }
  var id;
  var type;
  var name = stream.currReading[stream.position++];
  if (!name.indexOf(".")) {
    id = 1;
    type = 4
  } else {
    try {
      var child = FS.lookupNode(stream.node, name)
    } catch (e) {
      return _readdir_r(dirp, entry, result)
    }
    id = child.id;
    type = FS.isChrdev(child.mode) ? 2 : FS.isDir(child.mode) ? 4 : FS.isLink(child.mode) ? 10 : 8
  }
  HEAP32[entry >> 2] = id;
  HEAP32[entry + 4 >> 2] = stream.position;
  HEAP32[entry + 8 >> 2] = 268;
  for (var i = 0; i < name.length; i++) {
    HEAP8[entry + 11 + i >> 0] = name.charCodeAt(i)
  }
  HEAP8[entry + 11 + i >> 0] = 0;
  HEAP8[entry + 10 >> 0] = type;
  HEAP32[result >> 2] = entry;
  return 0
}

function _readdir(dirp) {
  var stream = FS.getStreamFromPtr(dirp);
  if (!stream) {
    ___setErrNo(ERRNO_CODES.EBADF);
    return 0
  }
  if (!_readdir.entry) _readdir.entry = _malloc(268);
  if (!_readdir.result) _readdir.result = _malloc(4);
  var err = _readdir_r(dirp, _readdir.entry, _readdir.result);
  if (err) {
    ___setErrNo(err);
    return 0
  }
  return HEAP32[_readdir.result >> 2]
}
var _BItoD = true;
Module["_bitshift64Shl"] = _bitshift64Shl;

function _abort() {
  Module["abort"]()
}
var EmterpreterAsync = {
  initted: false,
  state: 0,
  saveStack: "",
  yieldCallbacks: [],
  postAsync: null,
  asyncFinalizers: [],
  ensureInit: (function() {
    if (this.initted) return;
    this.initted = true
  }),
  setState: (function(s) {
    this.ensureInit();
    this.state = s;
    asm.setAsyncState(s)
  }),
  handle: (function(doAsyncOp, yieldDuring) {
    Module["noExitRuntime"] = true;
    if (EmterpreterAsync.state === 0) {
      var stack = new Int32Array(HEAP32.subarray(EMTSTACKTOP >> 2, asm.emtStackSave() >> 2));
      var stacktop = asm.stackSave();
      var resumedCallbacksForYield = false;

      function resumeCallbacksForYield() {
        if (resumedCallbacksForYield) return;
        resumedCallbacksForYield = true;
        EmterpreterAsync.yieldCallbacks.forEach((function(func) {
          func()
        }));
        Browser.resumeAsyncCallbacks()
      }
      var callingDoAsyncOp = 1;
      doAsyncOp(function resume(post) {
        if (callingDoAsyncOp) {
          assert(callingDoAsyncOp === 1);
          callingDoAsyncOp++;
          setTimeout((function() {
            resume(post)
          }), 0);
          return
        }
        assert(EmterpreterAsync.state === 1 || EmterpreterAsync.state === 3);
        EmterpreterAsync.setState(3);
        if (yieldDuring) {
          resumeCallbacksForYield()
        }
        HEAP32.set(stack, EMTSTACKTOP >> 2);
        EmterpreterAsync.setState(2);
        if (Browser.mainLoop.func) {
          Browser.mainLoop.resume()
        }
        assert(!EmterpreterAsync.postAsync);
        EmterpreterAsync.postAsync = post || null;
        asm.emterpret(stack[0]);
        if (!yieldDuring && EmterpreterAsync.state === 0) {
          Browser.resumeAsyncCallbacks()
        }
        if (EmterpreterAsync.state === 0) {
          EmterpreterAsync.asyncFinalizers.forEach((function(func) {
            func()
          }));
          EmterpreterAsync.asyncFinalizers.length = 0
        }
      });
      callingDoAsyncOp = 0;
      EmterpreterAsync.setState(1);
      if (Browser.mainLoop.func) {
        Browser.mainLoop.pause()
      }
      if (yieldDuring) {
        setTimeout((function() {
          resumeCallbacksForYield()
        }), 0)
      } else {
        Browser.pauseAsyncCallbacks()
      }
    } else {
      assert(EmterpreterAsync.state === 2);
      EmterpreterAsync.setState(0);
      if (EmterpreterAsync.postAsync) {
        var ret = EmterpreterAsync.postAsync();
        EmterpreterAsync.postAsync = null;
        return ret
      }
    }
  })
};

function _emscripten_sleep(ms) {
  EmterpreterAsync.handle((function(resume) {
    setTimeout((function() {
      if (ABORT) return;
      resume()
    }), ms)
  }))
}

function _pthread_once(ptr, func) {
  if (!_pthread_once.seen) _pthread_once.seen = {};
  if (ptr in _pthread_once.seen) return;
  Runtime.dynCall("v", func);
  _pthread_once.seen[ptr] = 1
}

function _catclose(catd) {
  return 0
}

function _pthread_getspecific(key) {
  return PTHREAD_SPECIFIC[key] || 0
}
var _fabs = Math_abs;
var _floor = Math_floor;

function _lseek(fildes, offset, whence) {
  var stream = FS.getStream(fildes);
  if (!stream) {
    ___setErrNo(ERRNO_CODES.EBADF);
    return -1
  }
  try {
    return FS.llseek(stream, offset, whence)
  } catch (e) {
    FS.handleFSError(e);
    return -1
  }
}

function _fseek(stream, offset, whence) {
  var fd = _fileno(stream);
  var ret = _lseek(fd, offset, whence);
  if (ret == -1) {
    return -1
  }
  stream = FS.getStreamFromPtr(stream);
  stream.eof = false;
  return 0
}
var _emscripten_asm_const_int = true;

function __exit(status) {
  Module["exit"](status)
}

function _exit(status) {
  __exit(status)
}

function _pthread_setspecific(key, value) {
  if (!(key in PTHREAD_SPECIFIC)) {
    return ERRNO_CODES.EINVAL
  }
  PTHREAD_SPECIFIC[key] = value;
  return 0
}

function ___ctype_b_loc() {
  var me = ___ctype_b_loc;
  if (!me.ret) {
    var values = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 8195, 8194, 8194, 8194, 8194, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 24577, 49156, 49156, 49156, 49156, 49156, 49156, 49156, 49156, 49156, 49156, 49156, 49156, 49156, 49156, 49156, 55304, 55304, 55304, 55304, 55304, 55304, 55304, 55304, 55304, 55304, 49156, 49156, 49156, 49156, 49156, 49156, 49156, 54536, 54536, 54536, 54536, 54536, 54536, 50440, 50440, 50440, 50440, 50440, 50440, 50440, 50440, 50440, 50440, 50440, 50440, 50440, 50440, 50440, 50440, 50440, 50440, 50440, 50440, 49156, 49156, 49156, 49156, 49156, 49156, 54792, 54792, 54792, 54792, 54792, 54792, 50696, 50696, 50696, 50696, 50696, 50696, 50696, 50696, 50696, 50696, 50696, 50696, 50696, 50696, 50696, 50696, 50696, 50696, 50696, 50696, 49156, 49156, 49156, 49156, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var i16size = 2;
    var arr = _malloc(values.length * i16size);
    for (var i = 0; i < values.length; i++) {
      HEAP16[arr + i * i16size >> 1] = values[i]
    }
    me.ret = allocate([arr + 128 * i16size], "i16*", ALLOC_NORMAL)
  }
  return me.ret
}

function _freelocale(locale) {
  _free(locale)
}

function _malloc(bytes) {
  var ptr = Runtime.dynamicAlloc(bytes + 8);
  return ptr + 8 & 4294967288
}
Module["_malloc"] = _malloc;

function ___cxa_allocate_exception(size) {
  return _malloc(size)
}

function _stat(path, buf, dontResolveLastLink) {
  path = typeof path !== "string" ? Pointer_stringify(path) : path;
  try {
    var stat = dontResolveLastLink ? FS.lstat(path) : FS.stat(path);
    HEAP32[buf >> 2] = stat.dev;
    HEAP32[buf + 4 >> 2] = 0;
    HEAP32[buf + 8 >> 2] = stat.ino;
    HEAP32[buf + 12 >> 2] = stat.mode;
    HEAP32[buf + 16 >> 2] = stat.nlink;
    HEAP32[buf + 20 >> 2] = stat.uid;
    HEAP32[buf + 24 >> 2] = stat.gid;
    HEAP32[buf + 28 >> 2] = stat.rdev;
    HEAP32[buf + 32 >> 2] = 0;
    HEAP32[buf + 36 >> 2] = stat.size;
    HEAP32[buf + 40 >> 2] = 4096;
    HEAP32[buf + 44 >> 2] = stat.blocks;
    HEAP32[buf + 48 >> 2] = stat.atime.getTime() / 1e3 | 0;
    HEAP32[buf + 52 >> 2] = 0;
    HEAP32[buf + 56 >> 2] = stat.mtime.getTime() / 1e3 | 0;
    HEAP32[buf + 60 >> 2] = 0;
    HEAP32[buf + 64 >> 2] = stat.ctime.getTime() / 1e3 | 0;
    HEAP32[buf + 68 >> 2] = 0;
    HEAP32[buf + 72 >> 2] = stat.ino;
    return 0
  } catch (e) {
    if (e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
      e.setErrno(ERRNO_CODES.ENOTDIR)
    }
    FS.handleFSError(e);
    return -1
  }
}

function ___cxa_pure_virtual() {
  ABORT = true;
  throw "Pure virtual function called!"
}

function _catgets(catd, set_id, msg_id, s) {
  return s
}
var _llvm_ctlz_i32 = true;

function _catopen(name, oflag) {
  return -1
}

function _getcwd(buf, size) {
  if (size == 0) {
    ___setErrNo(ERRNO_CODES.EINVAL);
    return 0
  }
  var cwd = FS.cwd();
  if (size < cwd.length + 1) {
    ___setErrNo(ERRNO_CODES.ERANGE);
    return 0
  } else {
    writeAsciiToMemory(cwd, buf);
    return buf
  }
}

function ___ctype_toupper_loc() {
  var me = ___ctype_toupper_loc;
  if (!me.ret) {
    var values = [128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255];
    var i32size = 4;
    var arr = _malloc(values.length * i32size);
    for (var i = 0; i < values.length; i++) {
      HEAP32[arr + i * i32size >> 2] = values[i]
    }
    me.ret = allocate([arr + 128 * i32size], "i32*", ALLOC_NORMAL)
  }
  return me.ret
}

function _pthread_cond_broadcast() {
  return 0
}

function ___cxa_guard_acquire(variable) {
  if (!HEAP8[variable >> 0]) {
    HEAP8[variable >> 0] = 1;
    return 1
  }
  return 0
}

function _closedir(dirp) {
  var fd = _fileno(dirp);
  var stream = FS.getStream(fd);
  if (stream.currReading) stream.currReading = null;
  return _close(fd)
}

function ___ctype_tolower_loc() {
  var me = ___ctype_tolower_loc;
  if (!me.ret) {
    var values = [128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255];
    var i32size = 4;
    var arr = _malloc(values.length * i32size);
    for (var i = 0; i < values.length; i++) {
      HEAP32[arr + i * i32size >> 2] = values[i]
    }
    me.ret = allocate([arr + 128 * i32size], "i32*", ALLOC_NORMAL)
  }
  return me.ret
}

function ___cxa_begin_catch(ptr) {
  __ZSt18uncaught_exceptionv.uncaught_exception--;
  EXCEPTIONS.caught.push(ptr);
  EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
  return ptr
}

function _llvm_eh_typeid_for(type) {
  return type
}
var _environ = allocate(1, "i32*", ALLOC_STATIC);
var ___environ = _environ;

function ___buildEnvironment(env) {
  var MAX_ENV_VALUES = 64;
  var TOTAL_ENV_SIZE = 1024;
  var poolPtr;
  var envPtr;
  if (!___buildEnvironment.called) {
    ___buildEnvironment.called = true;
    ENV["USER"] = "web_user";
    ENV["PATH"] = "/";
    ENV["PWD"] = "/";
    ENV["HOME"] = "/home/web_user";
    ENV["LANG"] = "C";
    ENV["_"] = Module["thisProgram"];
    poolPtr = allocate(TOTAL_ENV_SIZE, "i8", ALLOC_STATIC);
    envPtr = allocate(MAX_ENV_VALUES * 4, "i8*", ALLOC_STATIC);
    HEAP32[envPtr >> 2] = poolPtr;
    HEAP32[_environ >> 2] = envPtr
  } else {
    envPtr = HEAP32[_environ >> 2];
    poolPtr = HEAP32[envPtr >> 2]
  }
  var strings = [];
  var totalSize = 0;
  for (var key in env) {
    if (typeof env[key] === "string") {
      var line = key + "=" + env[key];
      strings.push(line);
      totalSize += line.length
    }
  }
  if (totalSize > TOTAL_ENV_SIZE) {
    throw new Error("Environment size exceeded TOTAL_ENV_SIZE!")
  }
  var ptrSize = 4;
  for (var i = 0; i < strings.length; i++) {
    var line = strings[i];
    writeAsciiToMemory(line, poolPtr);
    HEAP32[envPtr + i * ptrSize >> 2] = poolPtr;
    poolPtr += line.length + 1
  }
  HEAP32[envPtr + strings.length * ptrSize >> 2] = 0
}
var ENV = {};

function _dlopen(filename, flag) {
  filename = filename === 0 ? "__self__" : (ENV["LD_LIBRARY_PATH"] || "/") + Pointer_stringify(filename);
  if (DLFCN.loadedLibNames[filename]) {
    var handle = DLFCN.loadedLibNames[filename];
    DLFCN.loadedLibs[handle].refcount++;
    return handle
  }
  if (filename === "__self__") {
    var handle = -1;
    var lib_module = Module;
    var cached_functions = {}
  } else {
    var target = FS.findObject(filename);
    if (!target || target.isFolder || target.isDevice) {
      DLFCN.errorMsg = "Could not find dynamic lib: " + filename;
      return 0
    } else {
      FS.forceLoadFile(target);
      var lib_data = FS.readFile(filename, {
        encoding: "utf8"
      })
    }
    try {
      var lib_module = eval(lib_data)(Runtime.alignFunctionTables(), Module)
    } catch (e) {
      DLFCN.errorMsg = "Could not evaluate dynamic lib: " + filename;
      return 0
    }
    var handle = 1;
    for (var key in DLFCN.loadedLibs) {
      if (DLFCN.loadedLibs.hasOwnProperty(key)) handle++
    }
    if (flag & 256) {
      for (var ident in lib_module) {
        if (lib_module.hasOwnProperty(ident)) {
          Module[ident] = lib_module[ident]
        }
      }
    }
    var cached_functions = {}
  }
  DLFCN.loadedLibs[handle] = {
    refcount: 1,
    name: filename,
    module: lib_module,
    cached_functions: cached_functions
  };
  DLFCN.loadedLibNames[filename] = handle;
  return handle
}

function _fseeko() {
  return _fseek.apply(null, arguments)
}

function ___cxa_call_unexpected(exception) {
  Module.printErr("Unexpected exception thrown, this is not properly supported - aborting");
  ABORT = true;
  throw exception
}
Module["_strcpy"] = _strcpy;

function ___cxa_get_exception_ptr(ptr) {
  return ptr
}

function _fgetc(stream) {
  var streamObj = FS.getStreamFromPtr(stream);
  if (!streamObj) return -1;
  if (streamObj.eof || streamObj.error) return -1;
  var ret = _fread(_fgetc.ret, 1, 1, stream);
  if (ret == 0) {
    return -1
  } else if (ret == -1) {
    streamObj.error = true;
    return -1
  } else {
    return HEAPU8[_fgetc.ret >> 0]
  }
}

function _getc() {
  return _fgetc.apply(null, arguments)
}
var ___dso_handle = allocate(1, "i32*", ALLOC_STATIC);
___errno_state = Runtime.staticAlloc(4);
HEAP32[___errno_state >> 2] = 0;
FS.staticInit();
__ATINIT__.unshift((function() {
  if (!Module["noFSInit"] && !FS.init.initialized) FS.init()
}));
__ATMAIN__.push((function() {
  FS.ignorePermissions = false
}));
__ATEXIT__.push((function() {
  FS.quit()
}));
Module["FS_createFolder"] = FS.createFolder;
Module["FS_createPath"] = FS.createPath;
Module["FS_createDataFile"] = FS.createDataFile;
Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
Module["FS_createLazyFile"] = FS.createLazyFile;
Module["FS_createLink"] = FS.createLink;
Module["FS_createDevice"] = FS.createDevice;
__ATINIT__.unshift((function() {
  TTY.init()
}));
__ATEXIT__.push((function() {
  TTY.shutdown()
}));
if (ENVIRONMENT_IS_NODE) {
  var fs = require("fs");
  var NODEJS_PATH = require("path");
  NODEFS.staticInit()
}
_fputc.ret = allocate([0], "i8", ALLOC_STATIC);
__ATINIT__.push((function() {
  SOCKFS.root = FS.mount(SOCKFS, {}, null)
}));
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) {
  Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice)
};
Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) {
  Browser.requestAnimationFrame(func)
};
Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) {
  Browser.setCanvasSize(width, height, noUpdates)
};
Module["pauseMainLoop"] = function Module_pauseMainLoop() {
  Browser.mainLoop.pause()
};
Module["resumeMainLoop"] = function Module_resumeMainLoop() {
  Browser.mainLoop.resume()
};
Module["getUserMedia"] = function Module_getUserMedia() {
  Browser.getUserMedia()
};
Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) {
  return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes)
};
___buildEnvironment(ENV);
_fgetc.ret = allocate([0], "i8", ALLOC_STATIC);
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);
staticSealed = true;
STACK_MAX = STACK_BASE + TOTAL_STACK;
DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);
assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");
var cttz_i8 = allocate([8, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 6, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 7, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 6, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0], "i8", ALLOC_DYNAMIC);

function invoke_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
  try {
    return Module["dynCall_iiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_iiiiiid(index, a1, a2, a3, a4, a5, a6) {
  try {
    return Module["dynCall_iiiiiid"](index, a1, a2, a3, a4, a5, a6)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_v(index) {
  try {
    Module["dynCall_v"](index)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_viiiii(index, a1, a2, a3, a4, a5) {
  try {
    Module["dynCall_viiiii"](index, a1, a2, a3, a4, a5)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_vi(index, a1) {
  try {
    Module["dynCall_vi"](index, a1)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_vii(index, a1, a2) {
  try {
    Module["dynCall_vii"](index, a1, a2)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_iiiiiii(index, a1, a2, a3, a4, a5, a6) {
  try {
    return Module["dynCall_iiiiiii"](index, a1, a2, a3, a4, a5, a6)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_ii(index, a1) {
  try {
    return Module["dynCall_ii"](index, a1)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_id(index, a1) {
  try {
    return Module["dynCall_id"](index, a1)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_iiiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11) {
  try {
    return Module["dynCall_iiiiiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_iiii(index, a1, a2, a3) {
  try {
    return Module["dynCall_iiii"](index, a1, a2, a3)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_viiiiiiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15) {
  try {
    Module["dynCall_viiiiiiiiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_viiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
  try {
    Module["dynCall_viiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_iddddii(index, a1, a2, a3, a4, a5, a6) {
  try {
    return Module["dynCall_iddddii"](index, a1, a2, a3, a4, a5, a6)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_viiiiii(index, a1, a2, a3, a4, a5, a6) {
  try {
    Module["dynCall_viiiiii"](index, a1, a2, a3, a4, a5, a6)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_ddd(index, a1, a2) {
  try {
    return Module["dynCall_ddd"](index, a1, a2)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_viiddddii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
  try {
    Module["dynCall_viiddddii"](index, a1, a2, a3, a4, a5, a6, a7, a8)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_di(index, a1) {
  try {
    return Module["dynCall_di"](index, a1)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_iddd(index, a1, a2, a3) {
  try {
    return Module["dynCall_iddd"](index, a1, a2, a3)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_viidii(index, a1, a2, a3, a4, a5) {
  try {
    Module["dynCall_viidii"](index, a1, a2, a3, a4, a5)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_iid(index, a1, a2) {
  try {
    return Module["dynCall_iid"](index, a1, a2)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_viiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
  try {
    Module["dynCall_viiiiiii"](index, a1, a2, a3, a4, a5, a6, a7)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
  try {
    Module["dynCall_viiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8, a9)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_viiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
  try {
    Module["dynCall_viiiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_iii(index, a1, a2) {
  try {
    return Module["dynCall_iii"](index, a1, a2)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_iiiiii(index, a1, a2, a3, a4, a5) {
  try {
    return Module["dynCall_iiiiii"](index, a1, a2, a3, a4, a5)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_iiiiiddi(index, a1, a2, a3, a4, a5, a6, a7) {
  try {
    return Module["dynCall_iiiiiddi"](index, a1, a2, a3, a4, a5, a6, a7)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_diii(index, a1, a2, a3) {
  try {
    return Module["dynCall_diii"](index, a1, a2, a3)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_dii(index, a1, a2) {
  try {
    return Module["dynCall_dii"](index, a1, a2)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_i(index) {
  try {
    return Module["dynCall_i"](index)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_iiiii(index, a1, a2, a3, a4) {
  try {
    return Module["dynCall_iiiii"](index, a1, a2, a3, a4)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_viii(index, a1, a2, a3) {
  try {
    Module["dynCall_viii"](index, a1, a2, a3)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_idi(index, a1, a2) {
  try {
    return Module["dynCall_idi"](index, a1, a2)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_iiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
  try {
    return Module["dynCall_iiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_iiiiid(index, a1, a2, a3, a4, a5) {
  try {
    return Module["dynCall_iiiiid"](index, a1, a2, a3, a4, a5)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}

function invoke_viiii(index, a1, a2, a3, a4) {
  try {
    Module["dynCall_viiii"](index, a1, a2, a3, a4)
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    asm["setThrew"](1, 0)
  }
}
Module.asmGlobalArg = {
  "Math": Math,
  "Int8Array": Int8Array,
  "Int16Array": Int16Array,
  "Int32Array": Int32Array,
  "Uint8Array": Uint8Array,
  "Uint16Array": Uint16Array,
  "Uint32Array": Uint32Array,
  "Float32Array": Float32Array,
  "Float64Array": Float64Array,
  "NaN": NaN,
  "Infinity": Infinity,
  "byteLength": byteLength
};
Module.asmLibraryArg = {
  "abort": abort,
  "assert": assert,
  "invoke_iiiiiiii": invoke_iiiiiiii,
  "invoke_iiiiiid": invoke_iiiiiid,
  "invoke_v": invoke_v,
  "invoke_viiiii": invoke_viiiii,
  "invoke_vi": invoke_vi,
  "invoke_vii": invoke_vii,
  "invoke_iiiiiii": invoke_iiiiiii,
  "invoke_ii": invoke_ii,
  "invoke_id": invoke_id,
  "invoke_iiiiiiiiiiii": invoke_iiiiiiiiiiii,
  "invoke_iiii": invoke_iiii,
  "invoke_viiiiiiiiiiiiiii": invoke_viiiiiiiiiiiiiii,
  "invoke_viiiiiiii": invoke_viiiiiiii,
  "invoke_iddddii": invoke_iddddii,
  "invoke_viiiiii": invoke_viiiiii,
  "invoke_ddd": invoke_ddd,
  "invoke_viiddddii": invoke_viiddddii,
  "invoke_di": invoke_di,
  "invoke_iddd": invoke_iddd,
  "invoke_viidii": invoke_viidii,
  "invoke_iid": invoke_iid,
  "invoke_viiiiiii": invoke_viiiiiii,
  "invoke_viiiiiiiii": invoke_viiiiiiiii,
  "invoke_viiiiiiiiii": invoke_viiiiiiiiii,
  "invoke_iii": invoke_iii,
  "invoke_iiiiii": invoke_iiiiii,
  "invoke_iiiiiddi": invoke_iiiiiddi,
  "invoke_diii": invoke_diii,
  "invoke_dii": invoke_dii,
  "invoke_i": invoke_i,
  "invoke_iiiii": invoke_iiiii,
  "invoke_viii": invoke_viii,
  "invoke_idi": invoke_idi,
  "invoke_iiiiiiiii": invoke_iiiiiiiii,
  "invoke_iiiiid": invoke_iiiiid,
  "invoke_viiii": invoke_viiii,
  "_fabs": _fabs,
  "_dlsym": _dlsym,
  "_fread": _fread,
  "___cxa_guard_acquire": ___cxa_guard_acquire,
  "___assert_fail": ___assert_fail,
  "__ZSt18uncaught_exceptionv": __ZSt18uncaught_exceptionv,
  "___ctype_toupper_loc": ___ctype_toupper_loc,
  "__addDays": __addDays,
  "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing,
  "_ceilf": _ceilf,
  "___cxa_begin_catch": ___cxa_begin_catch,
  "_emscripten_memcpy_big": _emscripten_memcpy_big,
  "_sysconf": _sysconf,
  "_close": _close,
  "_readdir": _readdir,
  "_write": _write,
  "__isLeapYear": __isLeapYear,
  "_ftell": _ftell,
  "_emscripten_sleep": _emscripten_sleep,
  "___cxa_atexit": ___cxa_atexit,
  "___cxa_rethrow": ___cxa_rethrow,
  "_catclose": _catclose,
  "_closedir": _closedir,
  "_send": _send,
  "___cxa_free_exception": ___cxa_free_exception,
  "___cxa_find_matching_catch": ___cxa_find_matching_catch,
  "___cxa_guard_release": ___cxa_guard_release,
  "_opendir": _opendir,
  "_strerror_r": _strerror_r,
  "___setErrNo": ___setErrNo,
  "_newlocale": _newlocale,
  "___resumeException": ___resumeException,
  "_freelocale": _freelocale,
  "___cxa_call_unexpected": ___cxa_call_unexpected,
  "_dlclose": _dlclose,
  "___buildEnvironment": ___buildEnvironment,
  "___cxa_get_exception_ptr": ___cxa_get_exception_ptr,
  "_pthread_once": _pthread_once,
  "_localeconv": _localeconv,
  "_dlopen": _dlopen,
  "_stat": _stat,
  "_read": _read,
  "_fwrite": _fwrite,
  "_time": _time,
  "_pthread_mutex_lock": _pthread_mutex_lock,
  "_catopen": _catopen,
  "_exit": _exit,
  "_emscripten_asm_const_3": _emscripten_asm_const_3,
  "_emscripten_asm_const_2": _emscripten_asm_const_2,
  "___cxa_guard_abort": ___cxa_guard_abort,
  "_readdir_r": _readdir_r,
  "_dlerror": _dlerror,
  "_getcwd": _getcwd,
  "___ctype_b_loc": ___ctype_b_loc,
  "_lseek": _lseek,
  "_vfprintf": _vfprintf,
  "___cxa_allocate_exception": ___cxa_allocate_exception,
  "_floor": _floor,
  "_pwrite": _pwrite,
  "_open": _open,
  "_uselocale": _uselocale,
  "___cxa_end_catch": ___cxa_end_catch,
  "_pthread_getspecific": _pthread_getspecific,
  "_fseek": _fseek,
  "_fclose": _fclose,
  "_pthread_key_create": _pthread_key_create,
  "_pthread_cond_broadcast": _pthread_cond_broadcast,
  "_recv": _recv,
  "_ftello": _ftello,
  "_abort": _abort,
  "_ceil": _ceil,
  "_fopen": _fopen,
  "___cxa_pure_virtual": ___cxa_pure_virtual,
  "_strftime": _strftime,
  "_pthread_cond_wait": _pthread_cond_wait,
  "___gxx_personality_v0": ___gxx_personality_v0,
  "_ungetc": _ungetc,
  "_fflush": _fflush,
  "_strftime_l": _strftime_l,
  "_fprintf": _fprintf,
  "__reallyNegative": __reallyNegative,
  "_llvm_eh_typeid_for": _llvm_eh_typeid_for,
  "_catgets": _catgets,
  "_fileno": _fileno,
  "__exit": __exit,
  "__arraySum": __arraySum,
  "_fseeko": _fseeko,
  "___ctype_tolower_loc": ___ctype_tolower_loc,
  "_pthread_mutex_unlock": _pthread_mutex_unlock,
  "_pread": _pread,
  "_mkport": _mkport,
  "_sbrk": _sbrk,
  "_getc": _getc,
  "_emscripten_set_main_loop": _emscripten_set_main_loop,
  "___errno_location": ___errno_location,
  "_pthread_setspecific": _pthread_setspecific,
  "_fgetc": _fgetc,
  "_fputc": _fputc,
  "___cxa_throw": ___cxa_throw,
  "_strerror": _strerror,
  "_emscripten_asm_const_1": _emscripten_asm_const_1,
  "__formatString": __formatString,
  "_atexit": _atexit,
  "STACKTOP": STACKTOP,
  "STACK_MAX": STACK_MAX,
  "tempDoublePtr": tempDoublePtr,
  "ABORT": ABORT,
  "cttz_i8": cttz_i8,
  "___dso_handle": ___dso_handle,
  "_stderr": _stderr,
  "_stdin": _stdin,
  "_stdout": _stdout
};
Module.asmLibraryArg["EMTSTACKTOP"] = EMTSTACKTOP;
Module.asmLibraryArg["EMT_STACK_MAX"] = EMT_STACK_MAX;
Module.asmLibraryArg["eb"] = eb; // EMSCRIPTEN_START_ASM