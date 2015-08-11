"use strict";

var AXIS_FACTOR = 5;

var AXIS_POINTS = [
    scaleAxis(vec3(0, 0, 0)), scaleAxis(vec3(1, 0, 0)),
    scaleAxis(vec3(0.98, -0.02, 0)), scaleAxis(vec3(1, 0, 0)),
    scaleAxis(vec3(0.98, 0.02, 0)), scaleAxis(vec3(1, 0, 0)),

    scaleAxis(vec3(0, 0, 0)), scaleAxis(vec3(0, 1, 0)),
    scaleAxis(vec3(0, 0.98, -0.02)), scaleAxis(vec3(0, 1, 0)),
    scaleAxis(vec3(0, 0.98, 0.02)), scaleAxis(vec3(0, 1, 0)),

    scaleAxis(vec3(0, 0, 0)), scaleAxis(vec3(0, 0, 1)),
    scaleAxis(vec3(-0.02, 0, 0.98)), scaleAxis(vec3(0, 0, 1)),
    scaleAxis(vec3(0.02, 0, 0.98)), scaleAxis(vec3(0, 0, 1))];
var AXIS_COLOR = vec4(0, 0, 0, 1);

var EYE = scaleAxis(vec3(1, 1, 1));
var AT = scaleAxis(vec3(0, 0, 0));
var UP = scaleAxis(vec3(0, 1, 0));
var MODEL_VIEW_MATRIX = lookAt(EYE, AT, UP);

var FOVY = 75;
var ASPECT = 1;
var NEAR = scaleAxis(0.01);
var FAR = scaleAxis(4);
var PROJECTION_MATRIX = perspective(FOVY, ASPECT, NEAR, FAR);

var SUBDIVISION = 15;

var SPHERE_TEMPLATE = buildSphereTemplate();
var CONE_TEMPLATE = buildConeTemplate();
var CYLINDER_TEMPLATE = buildCylinderTemplate();

var SELECTED_COLOR = vec4(1, 1, 1, 1);

var gl;

var transformationMatrixLoc;
var colorLoc;

var type2shape = {};
var objects = [];

var objectIndex;

window.onload = function() {
    var ctx2d = document.getElementById("text-canvas").getContext("2d");
    ctx2d.fillText("X", 465, 385);
    ctx2d.fillText("Y", 253, 15);
    ctx2d.fillText("Z", 40, 385);

    var canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert("WebGL isn't available");
    }

    // Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.8, 0.8, 0.8, 1.0);

    // Enable depth testing and polygon offset
    // so lines will be in front of filled triangles
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.0, 2.0);

    // Load shaders and initialize attribute buffers
    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Prepare model data
    var indices = [];
    var points = [];

    points = points.concat(AXIS_POINTS);

    type2shape["sphere"] = {"template": SPHERE_TEMPLATE, "startIndex": indices.length};
    indices = indices.concat(shift(generateIndices(SPHERE_TEMPLATE), points.length));
    points = points.concat(generatePoints(SPHERE_TEMPLATE));

    type2shape["cone"] = {"template": CONE_TEMPLATE, "startIndex": indices.length};
    indices = indices.concat(shift(generateIndices(CONE_TEMPLATE), points.length));
    points = points.concat(generatePoints(CONE_TEMPLATE));

    type2shape["cylinder"] = {"template": CYLINDER_TEMPLATE, "startIndex": indices.length};
    indices = indices.concat(shift(generateIndices(CYLINDER_TEMPLATE), points.length));
    points = points.concat(generatePoints(CYLINDER_TEMPLATE));

    // Load indices data into the GPU
    var iBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // Load vertex data into the GPU
    var vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);


    var modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(MODEL_VIEW_MATRIX));

    var projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(PROJECTION_MATRIX));

    transformationMatrixLoc = gl.getUniformLocation(program, "transformationMatrix");
    colorLoc = gl.getUniformLocation(program, "color");


    var objectsSelect = document.getElementById("objects");
    objectsSelect.onchange = function(event) {
        objectIndex = event.target.selectedIndex;

        requestAnimFrame(render);
    };

    var addObject = function(type) {
        var x = scaleAxis(getRandomArbitrary(-1, 1) * 0.5);
        var y = scaleAxis(getRandomArbitrary(-1, 1) * 0.5);
        var z = scaleAxis(getRandomArbitrary(-1, 1) * 0.5);
        var r = Math.random();
        var g = Math.random();
        var b = Math.random();
        objects.push({"type": type, "transformation": translate(x, y, z), "color": vec4(r, g, b, 1)});

        var option = document.createElement("option");
        option.text = "Object" + objects.length + " (" + type + ")";
        objectsSelect.add(option);
        objectsSelect.size = objects.length;
        objectsSelect.selectedIndex = objects.length - 1;
        objectsSelect.dispatchEvent(new Event("change"));
    };

    var typeSelect = document.getElementById("type");
    document.getElementById("create").onclick = function() {
        var type = typeSelect.options[typeSelect.selectedIndex].value;
        addObject(type);
    };

    var handler = function(event) {
        var object = objects[objectIndex];

        var fields = event.target.value.split(" ");
        if (fields[0] === "translation") {
            var translations = fields[1].split(",");
            var x = Number(translations[0]);
            var y = Number(translations[1]);
            var z = Number(translations[2]);

            object["transformation"] = mult(translate(x, y, z), object["transformation"]);
        } else if (fields[0] === "rotation") {
            var angle = Number(fields[1]);
            var axis = fields[2].split(",").map(Number);

            object["transformation"] = mult(rotate(angle, axis), object["transformation"]);
        } else if (fields[0] === "scale") {
            var x = y = z = Number(fields[1]);

            object["transformation"] = mult(object["transformation"], scalem(x, y, z));
        }

        requestAnimFrame(render);
    };
    var transformation_buttons = document.getElementsByClassName("transformation");
    for (var i = 0; i < transformation_buttons.length; i++) {
        transformation_buttons[i].onclick = handler;
    }

    addObject("sphere");
    addObject("cone");
    addObject("cylinder");

    render();
};

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

function scaleAxis(value) {
    if (typeof value === "number") {
        value *= AXIS_FACTOR;
    } else {
        for (var i = 0; i < value.length; i++) {
            value[i] *= AXIS_FACTOR;
        }
    }
    return value;
}

function buildSphereTemplate() {
    var topPole = vec3(0, 1, 0);
    var downPole = vec3(0, -1, 0);

    var longitudes = [];
    for (var i = 0; i < SUBDIVISION; i++) {
        longitudes.push([]);
    }
    for (var i = 1; i < SUBDIVISION; i++) {
        var theta = -Math.PI / 2 + Math.PI / SUBDIVISION * i;
        for (var j = 0; j < SUBDIVISION; j++) {
            var phi = 2 * Math.PI / SUBDIVISION * j;

            longitudes[j].push(vec3(Math.cos(theta) * Math.sin(phi), -Math.sin(theta), Math.cos(theta) * Math.cos(phi)));
        }
    }

    return {"topPole": topPole, "downPole": downPole, "longitudes": longitudes};
}

function buildConeTemplate() {
    var topPole = vec3(0, 1, 0);
    var downPole = vec3(0, 0, 0);

    var longitudes = [];
    for (var i = 0; i < SUBDIVISION; i++) {
        longitudes.push([]);
    }
    for (var i = 0; i < SUBDIVISION; i++) {
        var phi = 2 * Math.PI / SUBDIVISION * i;

        longitudes[i].push(vec3(Math.sin(phi), 0, Math.cos(phi)));
        longitudes[i].push(vec3(Math.sin(phi), 0, Math.cos(phi)));
    }

    return {"topPole": topPole, "downPole": downPole, "longitudes": longitudes};
}

function buildCylinderTemplate() {
    var topPole = vec3(0, 1, 0);
    var downPole = vec3(0, -1, 0);

    var longitudes = [];
    for (var i = 0; i < SUBDIVISION; i++) {
        longitudes.push([]);
    }
    for (var i = 0; i <= SUBDIVISION; i++) {
        var y = 1 - 2 / SUBDIVISION * i;
        for (var j = 0; j < SUBDIVISION; j++) {
            var phi = 2 * Math.PI / SUBDIVISION * j;

            longitudes[j].push(vec3(Math.sin(phi), y, Math.cos(phi)));
        }
    }

    return {"topPole": topPole, "downPole": downPole, "longitudes": longitudes};
}

function generateIndices(template) {
    var indices = [];

    var longitudes = template["longitudes"];
    var longitudeNum = longitudes.length;
    var numInLongitude = longitudes[0].length;

    indices.push(0);
    for (var i = 0; i <= longitudeNum; i++) {
        indices.push(computeIndex(numInLongitude, i % longitudeNum, 0));
    }

    indices.push(1);
    for (var i = 0; i <= longitudeNum; i++) {
        indices.push(computeIndex(numInLongitude, i % longitudeNum, numInLongitude - 1));
    }

    for (var i = 0; i < longitudeNum; i++) {
        var longitudeIndex1 = i;
        var longitudeIndex2 = (i + 1) % longitudeNum;
        for (var j = 0; j < numInLongitude; j++) {
            indices.push(computeIndex(numInLongitude, longitudeIndex1, j), computeIndex(numInLongitude, longitudeIndex2, j));
        }
    }

    for (var i = 0; i < longitudeNum; i++) {
        indices.push(0);
        for (var j = 0; j < numInLongitude; j++) {
            indices.push(computeIndex(numInLongitude, i, j));
        }
        indices.push(1);
    }

    return indices;
}

function computeIndex(numInLongitude, longitudeIndex, indexInLongitude) {
    return 2 + longitudeIndex * numInLongitude + indexInLongitude;
}

function shift(indices, offset) {
    var result = [];

    for (var i = 0; i < indices.length; i++) {
        result.push(indices[i] + offset);
    }

    return result;
}

function generatePoints(template) {
    var points = [];

    points.push(template["topPole"]);
    points.push(template["downPole"]);
    var longitudes = template["longitudes"];
    for (var i = 0; i < longitudes.length; i++) {
        for (var j = 0; j < longitudes[i].length; j++) {
            points.push(longitudes[i][j]);
        }
    }

    return points;
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniformMatrix4fv(transformationMatrixLoc, false, flatten(mat4()));
    gl.uniform4fv(colorLoc, flatten(AXIS_COLOR));
    gl.drawArrays(gl.LINES, 0, AXIS_POINTS.length);

    for (var i = 0; i < objects.length; i++) {
        var object = objects[i];
        var type = object["type"];
        var shape = type2shape[type];
        var template = shape["template"];
        var longitudes = template["longitudes"];
        var longitudeNum = longitudes.length;
        var numInLongitude = longitudes[0].length;
        var color = object["color"];
        var inversed_color = vec4(1 - color[0], 1 - color[1], 1 - color[2], 1);

        gl.uniformMatrix4fv(transformationMatrixLoc, false, flatten(object["transformation"]));

        gl.uniform4fv(colorLoc, flatten(color));
        var offset = shape["startIndex"] * 2;
        
        gl.drawElements(gl.TRIANGLE_FAN, longitudeNum + 2, gl.UNSIGNED_SHORT, offset);
        offset += (longitudeNum + 2) * 2;
        
        gl.drawElements(gl.TRIANGLE_FAN, longitudeNum + 2, gl.UNSIGNED_SHORT, offset);
        offset += (longitudeNum + 2) * 2;

        var saved_offset = offset;
        for (var j = 0; j < longitudeNum; j++) {
            gl.drawElements(gl.TRIANGLE_STRIP, numInLongitude * 2, gl.UNSIGNED_SHORT, offset);
            offset += (numInLongitude * 2) * 2;
        }

        
        gl.uniform4fv(colorLoc, flatten(i == objectIndex ? SELECTED_COLOR : inversed_color));

        offset = saved_offset;
        for (var j = 0; j < longitudeNum; j++) {
            gl.drawElements(gl.LINE_STRIP, numInLongitude * 2, gl.UNSIGNED_SHORT, offset);
            offset += (numInLongitude * 2) * 2;
        }

        for (var j = 0; j < longitudeNum; j++) {
            gl.drawElements(gl.LINE_STRIP, numInLongitude + 2, gl.UNSIGNED_SHORT, offset);
            offset += (numInLongitude + 2) * 2;
        }
    }
}
