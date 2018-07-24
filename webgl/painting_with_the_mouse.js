"use strict";

var VERTEX_NUM_LIMIT = 65536;

var index = 0;

var startIndices = [];
var counts = [];
var colors = [];
var lineWidths = [];

window.onload = function() {
    var inputs = [document.getElementById("rInput"), document.getElementById("gInput"), document.getElementById("bInput"), document.getElementById("alphaInput")];
    var lineWidth = document.getElementById("lineWidth");
    for (var i = 0; i < inputs.length; i++) {
        inputs[i].oninput = function(event) {
            syncOutput(event.target);

            var r = Number(inputs[0].value);
            var g = Number(inputs[1].value);
            var b = Number(inputs[2].value);
            var a = Number(inputs[3].value);
            var rgbStr = "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";

            document.getElementById("drawingColor").style.backgroundColor = rgbStr;
            lineWidth.style.backgroundColor = rgbStr;
        };
    }

    var predefinedColor = document.getElementById("predefined-color");
    predefinedColor.onchange = function() {
        var rgb = predefinedColor.options[predefinedColor.selectedIndex].value.split(",");
        
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].value = rgb[i];
            inputs[i].dispatchEvent(new Event("input"));
        }
    };

    document.getElementById("widthInput").oninput = function(event) {
        var input = event.target;
        syncOutput(input);

        lineWidth.style.height = input.value + 'px';
    };

    buildWebGL(inputs, widthInput);
};

function syncOutput(input) {
    var output = input.parentElement.getElementsByTagName("output")[0];
    output.value = input.value;
}

function buildWebGL(inputs, widthInput) {
    var canvas = document.getElementById("gl-canvas");

    var gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert("WebGL isn't available");
    }

    // Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.8, 0.8, 0.8, 1.0);

    // Load shaders and initialize attribute buffers
    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Load vertex data into the GPU
    var vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, VERTEX_NUM_LIMIT * 8, gl.STATIC_DRAW);
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    var colorLoc = gl.getUniformLocation(program, "color");


    var addPoint = function(event) {
        var canvasMouseX = event.clientX - (canvas.offsetLeft - window.pageXOffset);
        var canvasMouseY = event.clientY - (canvas.offsetTop - window.pageYOffset);
        
        var point = vec2(2 * canvasMouseX / canvas.width - 1, 2 * (canvas.height - canvasMouseY) / canvas.height - 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, index * 8, flatten(point));

        index++;
        counts[counts.length - 1]++;

        requestAnimFrame(function() {
            render(gl, colorLoc);
        });
    };

    canvas.onmousedown = function(event) {
        startIndices.push(index);
        counts.push(0);
        colors.push(flatten(buildColor(inputs)));
        lineWidths.push(Number(widthInput.value));

        addPoint(event);

        canvas.onmouseup = endDraw;
        canvas.onmouseout = endDraw;

        canvas.onmousemove = addPoint;
    };

    var endDraw = function(event) {
        canvas.onmouseup = null;
        canvas.onmouseout = null;

        canvas.onmousemove = null;
    };

    render(gl, colorLoc);
}

function buildColor(inputs) {
    var r = Number(inputs[0].value) / 255;
    var g = Number(inputs[1].value) / 255;
    var b = Number(inputs[2].value) / 255;
    var a = Number(inputs[3].value);

    return vec4(r, g, b, a);
}

function render(gl, colorLoc) {
    gl.clear(gl.COLOR_BUFFER_BIT);

    for (var i = 0; i < startIndices.length; i++) {
        gl.uniform4fv(colorLoc, colors[i]);
        gl.lineWidth(lineWidths[i]);
        gl.drawArrays(gl.LINE_STRIP, startIndices[i], counts[i]);
    }
}
