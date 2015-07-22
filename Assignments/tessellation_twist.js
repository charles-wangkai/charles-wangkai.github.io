"use strict";

window.onload = function() {
    var handler = function() {
        updateCanvas();
    };
    var inputs = document.getElementsByTagName("input");
    for (var i = 0; i < inputs.length; i++) {
        inputs[i].onchange = handler;
    }

    updateCanvas();
};

function updateCanvas() {
    var side = Number(document.getElementById("sideInput").value);
    var polygonPoints = computePolygonPoints(side);
    drawCanvas("gl-canvas-polygon", "vertex-shader-original", "LINE_LOOP", polygonPoints);

    var subdivision = Number(document.getElementById("subdivisionInput").value);
    var tessellationTriangles = tessellate(polygonPoints, subdivision);
    drawCanvas("gl-canvas-tessellation", "vertex-shader-original", "LINES", convertToLines(tessellationTriangles));
    
    drawCanvas("gl-canvas-twist", "vertex-shader-twist", "LINES", convertToLines(tessellationTriangles));
}

function convertToLines(triangles) {
    var lines = [];
    for (var i = 0; i < triangles.length; i += 3) {
        lines.push(triangles[i]);
        lines.push(triangles[i + 1]);

        lines.push(triangles[i + 1]);
        lines.push(triangles[i + 2]);

        lines.push(triangles[i + 2]);
        lines.push(triangles[i]);
    }
    return lines;
}

function computePolygonPoints(side) {
    var unitAngle = 2 * Math.PI / side;
    var firstAngle;
    if (side % 2 === 0) {
        firstAngle = Math.PI / 2 + unitAngle / 2;
    } else {
        firstAngle = Math.PI / 2;
    }

    var polygonPoints = []
    for (var i = 0; i < side; i++) {
        var angle = firstAngle + unitAngle * i;
        polygonPoints.push(vec2(Math.cos(angle), Math.sin(angle)));
    }
    return polygonPoints;
}

function tessellate(polygonPoints, subdivision) {
    var tessellationTriangles = [];
    for (var i = 1; i < polygonPoints.length - 1; i++) {
        divideTriangle(tessellationTriangles, polygonPoints[0], polygonPoints[i], polygonPoints[i + 1], subdivision);
    }
    return tessellationTriangles;
}

function divideTriangle(tessellationTriangles, a, b, c, subdivision) {
    if (subdivision === 0) {
        tessellationTriangles.push(a, b, c);
    } else {
        // Bisect the sides
        var ab = mix(a, b, 0.5);
        var bc = mix(b, c, 0.5);
        var ca = mix(c, a, 0.5);

        divideTriangle(tessellationTriangles, a, ab, ca, subdivision - 1);
        divideTriangle(tessellationTriangles, ab, b, bc, subdivision - 1);
        divideTriangle(tessellationTriangles, ca, bc, c, subdivision - 1);
        divideTriangle(tessellationTriangles, ab, bc, ca, subdivision - 1);
    }
}

function drawCanvas(canvasId, vertexId, modeStr, points) {
    var canvas = document.getElementById(canvasId);

    var gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert("WebGL isn't available");
    }

    var mode;
    if (modeStr === "LINE_LOOP") {
        mode = gl.LINE_LOOP;
    } else if (modeStr === "LINES") {
        mode = gl.LINES;
    }

    // Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    // Load shaders and initialize attribute buffers
    var program = initShaders(gl, vertexId, "fragment-shader");
    gl.useProgram(program);

    // Load the data into the GPU
    var bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

    // Associate our shader variables with our data buffer
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    var thetaLoc = gl.getUniformLocation(program, "theta");
    if (thetaLoc) {
        var theta = Number(document.getElementById("rotationInput").value);
        gl.uniform1f(thetaLoc, theta);
    }

    var dLoc = gl.getUniformLocation(program, "d");
    if (dLoc) {
        var d = Number(document.getElementById("twistInput").value);
        gl.uniform1f(dLoc, d);
    }

    render(gl, mode, points.length);
}

function render(gl, mode, count) {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(mode, 0, count);
}