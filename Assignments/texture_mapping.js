"use strict";

var AXIS_FACTOR = 1.75;

var EYE = scaleAxis(vec3(0, 0, 1));
var AT = scaleAxis(vec3(0, 0, 0));
var UP = scaleAxis(vec3(0, 1, 0));
var MODEL_VIEW_MATRIX = lookAt(EYE, AT, UP);

var FOVY = 75;
var ASPECT = 1;
var NEAR = scaleAxis(0.01);
var FAR = scaleAxis(4);
var PROJECTION_MATRIX = perspective(FOVY, ASPECT, NEAR, FAR);

var MERCATOR_MAX_LATITUDE = Math.atan(Math.sinh(Math.PI));

var X_AXIS = vec3(1, 0, 0);
var Y_AXIS = vec3(0, 1, 0);

var SUBDIVISION = 256;

var SPHERE_TEMPLATE = buildSphereTemplate();

var CHECKERBOARD_TEXTURE_SIZE = 256;
var CHECKERBOARD_CELL_SIZE = 32;

var ANIMATION2TEXT = {true: "►", false: "Ⅱ"};

var ANIMATION_ANGLE = 1;

var DELAY = 100;

var textureId2config = {};
var textureId = "map";

var projection2context = {"lnglat": {}, "mercator": {}};

var xAngle = 0;

var transformation = mat4();

var animation = true;

window.onload = function() {
    for (var projection in projection2context) {
        var canvas = document.getElementById(getCanvasId(projection));

        var gl = WebGLUtils.setupWebGL(canvas);
        if (!gl) {
            alert("WebGL isn't available");
        }
        projection2context[projection]["gl"] = gl;

        // Configure WebGL
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.8, 0.8, 0.8, 1);

        // Enable depth testing
        gl.enable(gl.DEPTH_TEST);

        // Load shaders and initialize attribute buffers
        var program = initShaders(gl, "vertex-shader", "fragment-shader");
        gl.useProgram(program);

        // // Prepare model data
        var indices = generateIndices(SPHERE_TEMPLATE);
        var vertices = generateVertices(SPHERE_TEMPLATE);
        var points = vertices["points"];
        var texCoords = vertices[getKeyForTexCoord(projection, false)];

        // Load indices data into the GPU
        var iBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        // Load position data into the GPU
        var vBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

        var vPosition = gl.getAttribLocation(program, "vPosition");
        gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vPosition);

        // Load texture coord data into the GPU
        var tBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(texCoords), gl.STATIC_DRAW);

        var vTexCoord = gl.getAttribLocation(program, "vTexCoord");
        gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vTexCoord);


        var modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
        gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(MODEL_VIEW_MATRIX));

        var projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
        gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(PROJECTION_MATRIX));

        var texLoc = gl.getUniformLocation(program, "tex");
        gl.uniform1i(texLoc, 0);

        projection2context[projection]["transformationMatrixLoc"] = gl.getUniformLocation(program, "transformationMatrix");        
    }

    textureId2config["checkerboard"] = buildCheckerboardConfig();
    textureId2config["map"] = buildMapConfig();

    configureTexture();


    document.getElementById("textureId").onchange = function(event) {
        textureId = event.target.value;
        configureTexture();
    };

    document.getElementById("animation").onclick = function(event) {
        event.target.textContent = ANIMATION2TEXT[animation];
        animation = !animation;
    };

    var upButton = document.getElementById("up");
    var downButton = document.getElementById("down");
    var transformationHandler = function(event) {
        var fields = event.target.value.split(" ");
        var angle = Number(fields[0]);
        var axis = fields[1];

        if (axis === "x") {
            transformation = mult(rotate(angle, X_AXIS), transformation);

            xAngle += angle;
            upButton.disabled = (xAngle <= -90);
            downButton.disabled = (xAngle >= 90);
        } else if (axis === "y") {
            transformation = mult(transformation, rotate(angle, Y_AXIS));
        }
    };
    var transformationButtons = document.getElementsByClassName("transformation");
    for (var i = 0; i < transformationButtons.length; i++) {
        transformationButtons[i].onclick = transformationHandler;
    }


    render();
};

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

function buildCheckerboardConfig() {
    var image = new Uint8Array(3 * CHECKERBOARD_TEXTURE_SIZE * CHECKERBOARD_TEXTURE_SIZE);

    for (var i = 0; i < CHECKERBOARD_TEXTURE_SIZE; i++) {
        for (var j = 0; j <CHECKERBOARD_TEXTURE_SIZE; j++) {
            var cellX = Math.floor(i / (CHECKERBOARD_TEXTURE_SIZE / CHECKERBOARD_CELL_SIZE));
            var cellY = Math.floor(j / (CHECKERBOARD_TEXTURE_SIZE / CHECKERBOARD_CELL_SIZE));

            var c = ((cellX & 1) ^ (cellY & 1)) ? 255 : 0;

            image[3 * (i * CHECKERBOARD_TEXTURE_SIZE + j)] = c;
            image[3 * (i * CHECKERBOARD_TEXTURE_SIZE + j) + 1] = c;
            image[3 * (i * CHECKERBOARD_TEXTURE_SIZE + j) + 2] = c;
        }
    }

    return {"pixelsOrSource": true, "width": CHECKERBOARD_TEXTURE_SIZE, "height": CHECKERBOARD_TEXTURE_SIZE, "image": image};
}

function buildMapConfig() {
    return {"pixelsOrSource": false, "image": document.getElementById("map")};
}

function configureTexture() {
    var config = textureId2config[textureId];

    for (var projection in projection2context) {
        var gl = projection2context[projection]["gl"];

        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        
        if (config["pixelsOrSource"]) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, config["width"], config["height"], 0, gl.RGB, gl.UNSIGNED_BYTE, config["image"]);
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, config["image"]);            
        }

        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
    }
}

function buildSphereTemplate() {
    var topPolePoint = vec3(0, 1, 0);
    var topPoleTexCoord = vec2(0.5, 1);
    var topPole = createVertex(topPolePoint, topPoleTexCoord, topPoleTexCoord);

    var downPolePoint = vec3(0, -1, 0);
    var downPoleTexCoord = vec2(0.5, 0);
    var downPole = createVertex(downPolePoint, downPoleTexCoord, downPoleTexCoord);

    var longitudes = [];
    for (var i = 0; i <= SUBDIVISION; i++) {
        longitudes.push([]);
    }
    for (var i = 1; i < SUBDIVISION; i++) {
        var theta = -Math.PI / 2 + Math.PI / SUBDIVISION * i;
        for (var j = 0; j <= SUBDIVISION; j++) {
            var phi = 2 * Math.PI / SUBDIVISION * j;

            var point = vec3(Math.cos(theta) * Math.sin(phi), -Math.sin(theta), Math.cos(theta) * Math.cos(phi));
            var lnglatTexCoord = vec2(phi / (2 * Math.PI), 1 - (theta + Math.PI / 2) / Math.PI);
            
            var texCoordY;
            if (theta < -MERCATOR_MAX_LATITUDE) {
                texCoordY = 1;
            } else if (theta > MERCATOR_MAX_LATITUDE) {
                texCoordY = 0;
            } else {
                texCoordY = 0.5 - Math.log(Math.tan(Math.PI / 4 + theta / 2))/(2 * Math.PI);
            }
            var mercatorTexCoord = vec2(phi / (2 * Math.PI), texCoordY);

            var vertex = createVertex(point, lnglatTexCoord, mercatorTexCoord);
            longitudes[j].push(vertex);
        }
    }

    return {"topPole": topPole, "downPole": downPole, "longitudes": longitudes, "center": vec3(0, 0, 0)};
}

function createVertex(point, lnglatTexCoord, mercatorTexCoord) {
    var vertex = {};
    vertex["point"] = point;
    vertex[getKeyForTexCoord("lnglat", true)] = lnglatTexCoord;
    vertex[getKeyForTexCoord("mercator", true)] = mercatorTexCoord;

    return vertex;
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

function generateVertices(template) {
    var points = [];
    var lnglatTexCoords = [];
    var mercatorTexCoords = [];

    addVertex(points, lnglatTexCoords, mercatorTexCoords, template["topPole"]);
    addVertex(points, lnglatTexCoords, mercatorTexCoords, template["downPole"]);
    var longitudes = template["longitudes"];
    for (var i = 0; i < longitudes.length; i++) {
        for (var j = 0; j < longitudes[i].length; j++) {
            addVertex(points, lnglatTexCoords, mercatorTexCoords, longitudes[i][j]);
        }
    }

    var vertices = {};
    vertices["points"] = points;
    vertices[getKeyForTexCoord("lnglat", false)] = lnglatTexCoords;
    vertices[getKeyForTexCoord("mercator", false)] = mercatorTexCoords;

    return vertices;
}

function addVertex(points, lnglatTexCoords, mercatorTexCoords, vertex) {
    points.push(vertex["point"]);
    lnglatTexCoords.push(vertex[getKeyForTexCoord("lnglat", true)]);
    mercatorTexCoords.push(vertex[getKeyForTexCoord("mercator", true)]);
}

function getCanvasId(projection) {
    return "gl-canvas-" + projection;
}

function getKeyForTexCoord(projection, singular) {
    return projection + "-texCoord" + (singular ? "" : "s");
}

function drawSphere(gl) {
    var longitudes = SPHERE_TEMPLATE["longitudes"];
    var longitudeNum = longitudes.length;
    var numInLongitude = longitudes[0].length;
    var offset = 0;
    
    gl.drawElements(gl.TRIANGLE_FAN, longitudeNum + 2, gl.UNSIGNED_SHORT, offset);
    offset += (longitudeNum + 2) * 2;
    
    gl.drawElements(gl.TRIANGLE_FAN, longitudeNum + 2, gl.UNSIGNED_SHORT, offset);
    offset += (longitudeNum + 2) * 2;

    for (var i = 0; i < longitudeNum; i++) {
        gl.drawElements(gl.TRIANGLE_STRIP, numInLongitude * 2, gl.UNSIGNED_SHORT, offset);
        offset += (numInLongitude * 2) * 2;
    }
}

function render() {
    for (var projection in projection2context) {
        var gl = projection2context[projection]["gl"];

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.uniformMatrix4fv(projection2context[projection]["transformationMatrixLoc"], false, flatten(transformation));

        drawSphere(gl);
    }

    setTimeout(
        function () {
            if (animation) {
                transformation = mult(transformation, rotate(ANIMATION_ANGLE, Y_AXIS));
            }

            requestAnimFrame(render);
        },
        DELAY
    );
}