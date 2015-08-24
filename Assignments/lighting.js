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
var AXIS_COLOR = vec3(0, 0, 0);

var EYE = scaleAxis(vec3(1, 1, 1));
var AT = scaleAxis(vec3(0, 0, 0));
var UP = scaleAxis(vec3(0, 1, 0));
var MODEL_VIEW_MATRIX = lookAt(EYE, AT, UP);

var FOVY = 75;
var ASPECT = 1;
var NEAR = scaleAxis(0.01);
var FAR = scaleAxis(4);
var PROJECTION_MATRIX = perspective(FOVY, ASPECT, NEAR, FAR);

var SUBDIVISION = 32;

var SPHERE_TEMPLATE = buildSphereTemplate();
var CONE_TEMPLATE = buildConeTemplate();
var CYLINDER_TEMPLATE = buildCylinderTemplate();

var LIGHT_SCALE = AXIS_FACTOR / 100;
var LIGHT_SCALE_MATRIX = scalem(LIGHT_SCALE, LIGHT_SCALE, LIGHT_SCALE);

var LIGHT_DISTANCE_COEF_A = 1;
var LIGHT_DISTANCE_COEF_B = 0.05;
var LIGHT_DISTANCE_COEF_C = 0.05;

var LIGHT_MOVING_ANGLE = 3;
var LIGHT_MOVING_UNIT = AXIS_FACTOR / 50;
var LIGHT_MOVING_LINE_LIMIT = scaleAxis(0.9);

var LIGHT_AMBIENT = vec3(0.1, 0.1, 0.1);

var MATERIAL_AMBIENT = vec3(1, 1, 1);
var MATERIAL_SHININESS = 100;

var DELAY = 100;

var gl;

var mode2config = {"color": {}, "light": {}};
var config;

var type2shape = {};
var objects = [];

var distance = true;

var lights = [
    {"enabled": true, "path": "circle", "axis": "0,1,0", "direction": 1, "transformation": mult(translate(scaleAxis(0.5), scaleAxis(0.9), scaleAxis(0)), LIGHT_SCALE_MATRIX), "color": vec3(1, 0, 0)},
    {"enabled": true, "path": "line", "axis": "1,0,0", "direction": 1, "transformation": mult(translate(scaleAxis(0.9), scaleAxis(0), scaleAxis(0.3)), LIGHT_SCALE_MATRIX), "color": vec3(0, 0, 1)}
];

var objectIndex;
var lightIndex = 0;

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

    // Enable depth testing
    gl.enable(gl.DEPTH_TEST);

    // Load shaders and initialize attribute buffers
    mode2config["color"]["program"] = initShaders(gl, "vertex-shader-color", "fragment-shader-color");
    mode2config["light"]["program"] = initShaders(gl, "vertex-shader-light", "fragment-shader-light");

    // Prepare model data
    var indices = [];
    var points = [];
    var normals = [];

    points = points.concat(AXIS_POINTS);
    normals = normals.concat(createDummyVec4Array(AXIS_POINTS.length));

    type2shape["sphere"] = {"template": SPHERE_TEMPLATE, "startIndex": indices.length};
    indices = indices.concat(shift(generateIndices(SPHERE_TEMPLATE), points.length));
    var sphereVertices = generateVertices(SPHERE_TEMPLATE);
    points = points.concat(sphereVertices["points"]);
    normals = normals.concat(sphereVertices["normals"]);

    type2shape["cone"] = {"template": CONE_TEMPLATE, "startIndex": indices.length};
    indices = indices.concat(shift(generateIndices(CONE_TEMPLATE), points.length));
    var coneVertices = generateVertices(CONE_TEMPLATE);
    points = points.concat(coneVertices["points"]);
    normals = normals.concat(coneVertices["normals"]);

    type2shape["cylinder"] = {"template": CYLINDER_TEMPLATE, "startIndex": indices.length};
    indices = indices.concat(shift(generateIndices(CYLINDER_TEMPLATE), points.length));
    var cylinderVertices = generateVertices(CYLINDER_TEMPLATE);
    points = points.concat(cylinderVertices["points"]);
    normals = normals.concat(cylinderVertices["normals"]);

    for (var mode in mode2config) {
        config = mode2config[mode];
        var program = config["program"];

        config["vBuffer"] = gl.createBuffer();
        config["vPositionLoc"] = gl.getAttribLocation(program, "vPosition");
        if (mode === "light") {
            config["nBuffer"] = gl.createBuffer();
            config["vNormalLoc"] = gl.getAttribLocation(program, "vNormal");
        }

        switchMode(mode);

        // Load indices data into the GPU
        var iBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        // Load position data into the GPU
        gl.bindBuffer(gl.ARRAY_BUFFER, config["vBuffer"]);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);


        var modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
        gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(MODEL_VIEW_MATRIX));

        var projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
        gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(PROJECTION_MATRIX));

        config["transformationMatrixLoc"] = gl.getUniformLocation(program, "transformationMatrix");


        if (mode === "color") {
            config["colorLoc"] = gl.getUniformLocation(program, "color");
        }
        else if (mode === "light") {
            // Load normal data into the GPU
            gl.bindBuffer(gl.ARRAY_BUFFER, config["nBuffer"]);
            gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);


            var eyePositionLoc = gl.getUniformLocation(program, "eyePosition");
            gl.uniform4fv(eyePositionLoc, flatten(toPoint(EYE)));

            var ambientProduct = mult(LIGHT_AMBIENT, MATERIAL_AMBIENT);
            var ambientProductLoc = gl.getUniformLocation(program, "ambientProduct");
            gl.uniform3fv(ambientProductLoc, flatten(ambientProduct));

            var materialShininessLoc = gl.getUniformLocation(program, "materialShininess");
            gl.uniform1f(materialShininessLoc, MATERIAL_SHININESS);

            config["lightPositionsLoc"] = gl.getUniformLocation(program, "lightPositions");
            config["diffuseProductsLoc"] = gl.getUniformLocation(program, "diffuseProducts");
            config["specularProductsLoc"] = gl.getUniformLocation(program, "specularProducts");
            config["aLoc"] = gl.getUniformLocation(program, "a");
            config["bLoc"] = gl.getUniformLocation(program, "b");
            config["cLoc"] = gl.getUniformLocation(program, "c");
        }
    }


    var objectsSelect = document.getElementById("objects");
    objectsSelect.onchange = function(event) {
        objectIndex = event.target.selectedIndex;
    };

    var addObject = function(type) {
        var x = scaleAxis(getRandomBetween(-1, 1) * 0.5);
        var y = scaleAxis(getRandomBetween(-1, 1) * 0.5);
        var z = scaleAxis(getRandomBetween(-1, 1) * 0.5);
        var r = 1;
        var g = 1;
        var b = 1;
        objects.push({"type": type, "transformation": translate(x, y, z), "color": vec3(r, g, b)});

        var option = document.createElement("option");
        option.text = "Object" + objects.length + " (" + type + ")";
        objectsSelect.add(option);
        objectsSelect.size = objects.length;
        objectsSelect.selectedIndex = objects.length - 1;
        objectsSelect.dispatchEvent(new Event("change"));
    };

    var transformationHandler = function(event) {
        var fields = event.target.value.split(" ");

        var instance;
        if (fields[0] === "object") {
            instance = objects[objectIndex];
        } else if (fields[0] === "light") {
            instance = lights[lightIndex];
        }

        if (fields[1] === "translation") {
            var translations = fields[2].split(",");
            var x = Number(translations[0]);
            var y = Number(translations[1]);
            var z = Number(translations[2]);

            instance["transformation"] = mult(translate(x, y, z), instance["transformation"]);
        } else if (fields[1] === "rotation") {
            var angle = Number(fields[2]);
            var axis = fields[3].split(",").map(Number);

            instance["transformation"] = mult(rotate(angle, axis), instance["transformation"]);
        } else if (fields[1] === "scale") {
            var factor = Number(fields[2]);
            var x = factor;
            var y = factor;
            var z = factor;

            instance["transformation"] = mult(instance["transformation"], scalem(x, y, z));
        }
    };
    var transformationButtons = document.getElementsByClassName("transformation");
    for (var i = 0; i < transformationButtons.length; i++) {
        transformationButtons[i].onclick = transformationHandler;
    }

    var enabledCheckbox = document.getElementById("enabled");
    enabledCheckbox.onchange = function(event) {
        lights[lightIndex]["enabled"] = event.target.checked;
    };

    document.getElementById("distance").onchange = function(event) {
        distance = event.target.checked;
    };

    var pathHandler = function(event) {
        lights[lightIndex]["path"] = event.target.value;
    };
    var pathRadios = document.getElementsByName("path");
    for (var i = 0; i < pathRadios.length; i++) {
        pathRadios[i].onclick = pathHandler;
    }

    var axisHandler = function(event) {
        lights[lightIndex]["axis"] = event.target.value;
    };
    var axisRadios = document.getElementsByName("axis");
    for (var i = 0; i < axisRadios.length; i++) {
        axisRadios[i].onclick = axisHandler;
    };

    document.getElementById("lights").onchange = function(event) {
        lightIndex = event.target.selectedIndex;

        enabledCheckbox.checked = lights[lightIndex]["enabled"];

        for (var i = 0; i < pathRadios.length; i++) {
            if (pathRadios[i].value === lights[lightIndex]["path"]) {
                pathRadios[i].checked = true;
            }
        }

        for (var i = 0; i < axisRadios.length; i++) {
            if (axisRadios[i].value === lights[lightIndex]["axis"]) {
                axisRadios[i].checked = true;
            }
        }
    };

    addObject("sphere");
    addObject("cone");
    addObject("cylinder");

    render();
};

function switchMode(mode) {
    config = mode2config[mode];

    gl.useProgram(config["program"]);

    var vPositionLoc = config["vPositionLoc"];
    gl.bindBuffer(gl.ARRAY_BUFFER, config["vBuffer"]);
    gl.vertexAttribPointer(vPositionLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPositionLoc);

    if (mode === "light") {
        var vNormalLoc = config["vNormalLoc"];
        gl.bindBuffer(gl.ARRAY_BUFFER, config["nBuffer"]);
        gl.vertexAttribPointer(vNormalLoc, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vNormalLoc);
    }
}

function getRandomBetween(min, max) {
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
    var topPolePoint = vec3(0, 1, 0);
    var topPoleNormal = toVector(topPolePoint);
    var topPole = {"point": topPolePoint, "normal": topPoleNormal};

    var downPolePoint = vec3(0, -1, 0);
    var downPoleNormal = toVector(downPolePoint);
    var downPole = {"point": downPolePoint, "normal": downPoleNormal};

    var longitudes = [];
    for (var i = 0; i < SUBDIVISION; i++) {
        longitudes.push([]);
    }
    for (var i = 1; i < SUBDIVISION; i++) {
        var theta = -Math.PI / 2 + Math.PI / SUBDIVISION * i;
        for (var j = 0; j < SUBDIVISION; j++) {
            var phi = 2 * Math.PI / SUBDIVISION * j;

            var point = vec3(Math.cos(theta) * Math.sin(phi), -Math.sin(theta), Math.cos(theta) * Math.cos(phi));
            var normal = toVector(point);

            var vertex = {"point": point, "normal": normal};
            longitudes[j].push(vertex);
        }
    }

    return {"topPole": topPole, "downPole": downPole, "longitudes": longitudes, "center": vec3(0, 0, 0)};
}

function buildConeTemplate() {
    var topPolePoint = vec3(0, 1, 0);
    var topPoleNormal = toVector(vec3(0, 1, 0));
    var topPole = {"point": topPolePoint, "normal": topPoleNormal};

    var downPolePoint = vec3(0, 0, 0);
    var downPoleNormal = toVector(vec3(0, -1, 0));
    var downPole = {"point": downPolePoint, "normal": downPoleNormal};

    var longitudes = [];
    for (var i = 0; i < SUBDIVISION; i++) {
        longitudes.push([]);
    }
    for (var i = 0; i < SUBDIVISION; i++) {
        var phi = 2 * Math.PI / SUBDIVISION * i;

        var point = vec3(Math.sin(phi), 0, Math.cos(phi));

        var u = subtract(point, topPolePoint);
        var v = subtract(point, downPolePoint);
        var axis = cross(u, v);
        var normal = multiply(rotate(90, axis), toVector(u));

        var vertexUp = {"point": topPolePoint, "normal": normal};
        longitudes[i].push(vertexUp);

        var vertex = {"point": point, "normal": normal};
        longitudes[i].push(vertex);

        var vertexDownNormal = toVector(vec3(0, -1, 0));
        var vertexDown = {"point": point, "normal": vertexDownNormal};
        longitudes[i].push(vertexDown);
    }

    return {"topPole": topPole, "downPole": downPole, "longitudes": longitudes};
}

function buildCylinderTemplate() {
    var topPolePoint = vec3(0, 1, 0);
    var topPoleNormal = toVector(vec3(0, 1, 0));
    var topPole = {"point": topPolePoint, "normal": topPoleNormal};

    var downPolePoint = vec3(0, -1, 0);
    var downPoleNormal = toVector(vec3(0, -1, 0));
    var downPole = {"point": downPolePoint, "normal": downPoleNormal};

    var longitudes = [];
    for (var i = 0; i < SUBDIVISION; i++) {
        longitudes.push([]);
    }
    for (var i = 0; i < SUBDIVISION; i++) {
        var phi = 2 * Math.PI / SUBDIVISION * i;

        var point = vec3(Math.sin(phi), 1, Math.cos(phi));
        var normal = toVector(vec3(0, 1, 0));

        var vertex = {"point": point, "normal": normal};
        longitudes[i].push(vertex);
    }
    for (var i = 0; i <= SUBDIVISION; i++) {
        var y = 1 - 2 / SUBDIVISION * i;
        for (var j = 0; j < SUBDIVISION; j++) {
            var phi = 2 * Math.PI / SUBDIVISION * j;

            var point = vec3(Math.sin(phi), y, Math.cos(phi));
            var normal = toVector(vec3(Math.sin(phi), 0, Math.cos(phi)));

            var vertex = {"point": point, "normal": normal};
            longitudes[j].push(vertex);
        }
    }
    for (var i = 0; i < SUBDIVISION; i++) {
        var phi = 2 * Math.PI / SUBDIVISION * i;

        var point = vec3(Math.sin(phi), -1, Math.cos(phi));
        var normal = toVector(vec3(0, -1, 0));

        var vertex = {"point": point, "normal": normal};
        longitudes[i].push(vertex);
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

function generateVertices(template) {
    var points = [];
    var normals = [];

    addVertex(points, normals, template["topPole"]);
    addVertex(points, normals, template["downPole"]);
    var longitudes = template["longitudes"];
    for (var i = 0; i < longitudes.length; i++) {
        for (var j = 0; j < longitudes[i].length; j++) {
            addVertex(points, normals, longitudes[i][j]);
        }
    }

    return {"points": points, "normals": normals};
}

function addVertex(points, normals, vertex) {
    points.push(vertex["point"]);
    normals.push(vertex["normal"]);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    switchMode("color");

    gl.uniformMatrix4fv(config["transformationMatrixLoc"], false, flatten(mat4()));
    gl.uniform3fv(config["colorLoc"], flatten(AXIS_COLOR));
    gl.drawArrays(gl.LINES, 0, AXIS_POINTS.length);

    for (var i = 0; i < lights.length; i++) {
        var light = lights[i];

        if (light["enabled"]) {
            drawByColor(type2shape["sphere"], light["transformation"], light["color"]);
        }
    }

    switchMode("light");

    for (var i = 0; i < objects.length; i++) {
        var object = objects[i];
        
        drawByLight(type2shape[object["type"]], object["transformation"], object["color"]);
    }

    setTimeout(
        function () {
            for (var i = 0; i < lights.length; i++) {
                var light = lights[i];
                if (light["enabled"]) {
                    if (light["path"] === "circle") {
                        light["transformation"] = mult(rotate(LIGHT_MOVING_ANGLE, getAxisArray(light)), light["transformation"]);
                    } else if (light["path"] === "line") {
                        var oldAmount = getAmount(light);

                        light["transformation"] = mult(buildLightTranslation(light), light["transformation"]);
                        var newAmount = getAmount(light);

                        if (newAmount > LIGHT_MOVING_LINE_LIMIT && newAmount > oldAmount) {
                            light["direction"] = -light["direction"];
                        }
                    }
                }
            }

            requestAnimFrame(render);
        },
        DELAY
    );
}

function drawShape(shape) {
    var template = shape["template"];
    var longitudes = template["longitudes"];
    var longitudeNum = longitudes.length;
    var numInLongitude = longitudes[0].length;
    var offset = shape["startIndex"] * 2;
    
    gl.drawElements(gl.TRIANGLE_FAN, longitudeNum + 2, gl.UNSIGNED_SHORT, offset);
    offset += (longitudeNum + 2) * 2;
    
    gl.drawElements(gl.TRIANGLE_FAN, longitudeNum + 2, gl.UNSIGNED_SHORT, offset);
    offset += (longitudeNum + 2) * 2;

    for (var i = 0; i < longitudeNum; i++) {
        gl.drawElements(gl.TRIANGLE_STRIP, numInLongitude * 2, gl.UNSIGNED_SHORT, offset);
        offset += (numInLongitude * 2) * 2;
    }
}

function drawByColor(shape, transformation, color) {
    gl.uniformMatrix4fv(config["transformationMatrixLoc"], false, flatten(transformation));
    gl.uniform3fv(config["colorLoc"], flatten(color));

    drawShape(shape);
}

function drawByLight(shape, transformation, color) {
    gl.uniformMatrix4fv(config["transformationMatrixLoc"], false, flatten(transformation));

    var lightPositions = [];
    for (var i = 0; i < lights.length; i++) {
        lightPositions.push(getPosition(lights[i]));
    }
    gl.uniform4fv(config["lightPositionsLoc"], flatten(lightPositions));

    var illuminationProducts = [];
    for (var i = 0; i < lights.length; i++) {
        var illuminationProduct = mult(lights[i]["enabled"] ? lights[i]["color"] : vec3(), color);
        illuminationProducts.push(illuminationProduct);
    }
    gl.uniform3fv(config["diffuseProductsLoc"], flatten(illuminationProducts));
    gl.uniform3fv(config["specularProductsLoc"], flatten(illuminationProducts));

    var a;
    var b;
    var c;
    if (distance) {
        a = LIGHT_DISTANCE_COEF_A;
        b = LIGHT_DISTANCE_COEF_B;
        c = LIGHT_DISTANCE_COEF_C;
    } else {
        a = 1;
        b = 0;
        c = 0;
    }
    gl.uniform1f(config["aLoc"], a);
    gl.uniform1f(config["bLoc"], b);
    gl.uniform1f(config["cLoc"], c);

    drawShape(shape);
}

// Multiply a matrix m by a vector v
function multiply(m, v) {
    var result = [];
    for (var i = 0; i < v.length; i++) {
        var element = 0;
        for (var j = 0; j < v.length; j++) {
            element += m[i][j] * v[j];
        }
        result.push(element);
    }
    return vec4(result);
}

function getAxisArray(light) {
    return light["axis"].split(",").map(Number);
}

function buildLightTranslation(light) {
    var xyz = scale(light["direction"] * LIGHT_MOVING_UNIT, getAxisArray(light));
    return translate(xyz[0], xyz[1], xyz[2]);
}

function getAmount(light) {
    var position = getPosition(light);
    var axis = getAxisArray(light);
    for (var i = 0; i < axis.length; i++) {
        if (axis[i] === 1) {
            return Math.abs(position[i]);
        }
    }
}

function getPosition(light) {
    return multiply(light["transformation"], vec4(SPHERE_TEMPLATE["center"]));
}

function toPoint(x) {
    return vec4(x[0], x[1], x[2], 1);
}

function toVector(x) {
    return vec4(x[0], x[1], x[2], 0);
}

function createDummyVec4Array(length) {
    var result = [];
    for (var i = 0; i < length; i++) {
        result.push(toVector(vec3()));
    }
    return result;
}
