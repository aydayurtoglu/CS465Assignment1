"use strict";

var canvas;
var vcp;
var gl;

var maxNumVertices = 20000;
var index = 0;

var delay = 50;

var cindex = 0;
var strokeIndex = 0;
var points =  [];

var colors = [
  vec4(0.0, 0.0, 0.0, 1.0), // black
  vec4(1.0, 0.0, 0.0, 1.0), // red
  vec4(1.0, 1.0, 0.0, 1.0), // yellow
  vec4(0.0, 1.0, 0.0, 1.0), // green
  vec4(0.0, 0.0, 1.0, 1.0), // blue
  vec4(1.0, 0.0, 1.0, 1.0), // magenta
  vec4(0.0, 1.0, 1.0, 1.0), // cyan
  vec4(0.0, 0.0, 0.0, 0.0) // white
];
var t;
var numPolygons = 0;
var numIndices = [];
numIndices[0] = 0;
var start = [0];
var undoOperations=[10];
var redoOperations=[10];
var undoNo = 0;
var redoNo = 0;

var mouseClicked = false;
var capture = false;
var loadCanvas = false;
var lineColor = vec4(0.0, 1.0, 1.0, 1.0);
var colorPicker = false;

function colorChange(newValue)
{
    lineColor = newValue.color.rgb;
}

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");

    // visual color picker
    vcp = document.getElementById("colorpicker");
    var ctx = vcp.getContext("2d");
    
    vcp.width = 255;
    vcp.height = 255;
    

    function drawGradient(r, g, b) {
        var col = rgbToLSH(r, g, b);
        var gradB = ctx.createLinearGradient(0, 0, 0, 255);
        gradB.addColorStop(0, "white");
        gradB.addColorStop(1, "black");
        var gradC = ctx.createLinearGradient(0, 0, 255, 0);
        gradC.addColorStop(0, `hsla(${Math.floor(col.hue)},100%,50%,0)`);
        gradC.addColorStop(1, `hsla(${Math.floor(col.hue)},100%,50%,1)`);

        ctx.fillStyle = gradB;
        ctx.fillRect(0, 0, 255, 255);
        ctx.fillStyle = gradC;
        ctx.globalCompositeOperation = "multiply";
        ctx.fillRect(0, 0, 255, 255);
        ctx.globalCompositeOperation = "source-over";
    }

    function rgbToLSH(red, green, blue, result = {}) {
        var hue, sat, lum, min, max, dif, r, g, b;
        r = red / 255;
        g = green / 255;
        b = blue / 255;
        min = Math.min(r, g, b);
        max = Math.max(r, g, b);
        lum = (min + max) / 2;
        if (min === max) {
            hue = 0;
            sat = 0;
        } else {
            dif = max - min;
            sat = lum > 0.5 ? dif / (2 - max - min) : dif / (max + min);
            switch (max) {
            case r:
                hue = (g - b) / dif;
                break;
            case g:
                hue = 2 + ((b - r) / dif);
                break;
            case b:
                hue = 4 + ((r - g) / dif);
                break;
            }
            hue *= 60;
            if (hue < 0) {
            hue += 360;
            }
        }
        result.lum = lum * 255;
        result.sat = sat * 255;
        result.hue = hue;
        return result;
    }

    ////////
    // Display hue.png on a canvas
    drawGradient(0, 0, 0);
    var huecanvas = document.getElementById("huepicker");
    var huectx = huecanvas.getContext("2d");

    let gradient = huectx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, 'red');
    gradient.addColorStop(0.15, 'orange');
    gradient.addColorStop(0.3, 'yellow');
    gradient.addColorStop(0.5, 'green');
    gradient.addColorStop(0.7, 'cyan');
    gradient.addColorStop(0.85, 'blue');
    gradient.addColorStop(1, 'magenta');
    
    huectx.fillStyle = gradient;
    huectx.fillRect(0, 0, 100, 512);

    // Get the r, g, b values from this canvas and pass them to:
    var hueR, hueG, hueB;

    huecanvas.addEventListener("click", function (e) {
        
        var imgData = huectx.getImageData(e.layerX, e.layerY, 1, 1);

        hueR = imgData.data[0];
        hueG = imgData.data[1];
        hueB = imgData.data[2];
        
        drawGradient(hueR, hueG, hueB);
    });
    // Show the color on a canvas
    var colorCanvas = document.getElementById("showColor");
    var colorctx = colorCanvas.getContext("2d");
    colorctx.fillStyle = "black";
    colorctx.fillRect(0, 0, colorCanvas.width, colorCanvas.height);

    // get data from huepicker and pass them to lineColor variable as vec4
    vcp.addEventListener("click", function (e) {
        var r, g, b, a;

        var imgData = ctx.getImageData(e.layerX, e.layerY, 1, 1);

        r = imgData.data[0];
        g = imgData.data[1];
        b = imgData.data[2];
        a = imgData.data[3];

        lineColor = vec4( r / 255,  g / 255, b / 255, 1.0);

        colorctx.fillStyle = 'rgb(' + r + ', ' + g + ',' + b + ')';
        colorctx.fillRect(0, 0, colorCanvas.width, colorCanvas.height);

        colorPicker = true;
    });

    //gl = WebGLUtils.setupWebGL(canvas);
    gl = canvas.getContext("experimental-webgl", {preserveDrawingBuffer: true});
    if (!gl) {
        alert("WebGL isn't available");
    }

    var option = document.getElementById("mymenu");

    option.addEventListener("click", function() {
        cindex = option.selectedIndex;
        colorPicker = false;
    });
    
    /*
    function HSVtoRGB(h, s, v) {
        var r, g, b, i, f, p, q, t;
        if (arguments.length === 1) {
            s = h.s, v = h.v, h = h.h;
        }
        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }*/

    var c = document.getElementById("clearButton")
    c.addEventListener("click", function(){
        index = 0;
        numPolygons = 0;
        numIndices = [];
        numIndices[0] = 0;
        start = [0];
    });

    var undo = document.getElementById("undoButton")
    undo.addEventListener("click", function(){
        
        if (undoNo == 10 || (undoNo == 0 && redoNo != 0))
            return;

        else {
            undoOperations[undoNo] = numIndices[numPolygons];
            numIndices[numPolygons] = 0;
            numPolygons--;
            undoNo++;
        }
    });

    var redo = document.getElementById("clearButton")
    redo.addEventListener("click", function redo(){

        //redo a Stroke by pulling data from redoOperations array
        if (redoNo != 0 && undoNo == 0 ){
            numPolygons++;
            numIndices[numPolygons] = redoOperations[redoNo];
            redoOperations[redoNo] = 0;
            redoNo--;
        }
        //redo a stroke by pulling data from undoOperations array
        else if (undoNo != 0) {
            numPolygons++;
            numIndices[numPolygons] = undoOperations[undoNo];
            undoOperations[undoNo] = 0;
            undoNo--;
        }
        else {
            return;
        }
        
        
    });
   

    var save = document.getElementById("saveButton")
    save.addEventListener("click", function save(){
        capture = true;
    });
    
    var load = document.getElementById("loadButton")
    load.addEventListener("click", function save(){
        loadCanvas = true;
        
    });

    canvas.addEventListener("mousedown", function draw(event){
        mouseClicked = true;

        for (var i = undoNo; i > 0; i-- ){
            redoOperations[i] = undoOperations[i];
            undoOperations[i] = 0;
        }
        redoNo = undoNo;
        undoNo = 0;

        numPolygons++;
        numIndices[numPolygons] = 0;
        start[numPolygons] = index;
    });
  
    canvas.addEventListener("mouseup", function release(event){
        mouseClicked = false;
    });
  
    canvas.addEventListener("mousemove", function stroke(event) {
        if(mouseClicked){
            var r = 2000;
            t = vec2(2 * event.clientX / canvas.width - 1,
                2 * (canvas.height - event.clientY) / canvas.height - 1);
            gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
            gl.bufferSubData(gl.ARRAY_BUFFER, 8 * index, flatten(t));

            if (!colorPicker)
                t = vec4(colors[cindex]);
            else
                t = lineColor;

            gl.bindBuffer(gl.ARRAY_BUFFER, cBufferId);
            gl.bufferSubData(gl.ARRAY_BUFFER, 16 * index, flatten(t));

            numIndices[numPolygons]++;
            index++;

            var center = vec2(event.clientX, event.clientY); 
    
            points.push(center);
            for (var i = 0; i <= 100; i++){
                points.push(center + vec2(
                    r*Math.cos(i * 2 * Math.PI / 200),
                    r*Math.sin(i * 2 * Math.PI / 200) 
                ));
            }
        }
    });

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.8, 0.8, 0.8, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    //
    //  Load shaders and initialize attribute buffers
    //
    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    var bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, 8 * maxNumVertices, gl.STATIC_DRAW);
    var vPos = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPos, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPos);

    var cBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, 16 * maxNumVertices, gl.STATIC_DRAW);
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    render();
}

function render() {
    if (capture) {
        capture = false;

        var image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
        window.location.href=image;
    }

    gl.clear(gl.COLOR_BUFFER_BIT);

        for (var i = 0; i <= numPolygons; i++) {
            gl.drawArrays(gl.LINE_STRIP, start[i], numIndices[i]);
        }
    
    setTimeout(
        function() {
            requestAnimFrame(render);
        }, delay
    );

}