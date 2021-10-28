"use strict";

var canvas;
var vcp;
var gl;

var maxNumVertices = 200000;
var index = 0;
var delay = 50;

var cindex = 0;
var strokeIndex = 0;
var vertices;
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

var undoIndices = [10];
var undoNo = 0;

var mouseClicked = false;
var capture = false;
var loadCanvas = false;
var lineColor = vec4(0.0, 1.0, 1.0, 1.0);
var colorPicker = false;

var isShape = false;
var shapeNo;
var brush = true;
var layerNo = 3;
var layer = 0.8;
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
    colorctx.fillStyle = lineColor;
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

    var c = document.getElementById("clearButton")
    c.addEventListener("click", function(){
        index = 0;
        numPolygons = 0;
        numIndices = [];
        numIndices[0] = 0;
        start = [0];
    });

    var undo = document.getElementById("undoButton")
    undo.addEventListener("click", function undo(){
        
        if (undoNo == 10)
            return;

        else {//mark noOfIndices and starting indexes of undone stroke
            undoIndices[undoNo] = numIndices[numPolygons];
            numIndices[numPolygons] = 0;
            //increase undoNo and decrease numPolygons
            numPolygons--;
            undoNo++;
        }
    });

    var redo = document.getElementById("redoButton");
    redo.addEventListener("click", function redo(){

        //redo a stroke by pulling data from undoIndices array
        if (undoNo > 0) {
            undoNo--;
            numPolygons++;
            numIndices[numPolygons] = undoIndices[undoNo];
            undoIndices[undoNo] = 0;
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
        undoNo = 0;
        
        numPolygons++;
        numIndices[numPolygons] = 0;
        start[numPolygons] = index;
    });
  
    canvas.addEventListener("mouseup", function release(event){
        mouseClicked = false;
    });
  
    canvas.addEventListener("mousemove", function stroke(event) {
        if(mouseClicked && !isShape && brush){
            var color = new Array(16);
            if (!colorPicker){
                for (var i = 0; i < color.length ; i++) 
                {
                    color[i] = vec4(colors[cindex]);
                }
            }
            else {
                for (var i = 0; i < color.length ; i++) 
                {
                    color[i] = lineColor;
                }
            }
            var radius = 0.04;
            layer = layer - 0.00001;
        
            vertices = [
                vec4(2*event.clientX/canvas.width-1,
                    (2*(canvas.height-event.clientY)/canvas.height-1)+radius, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1)+radius,
                    2*(canvas.height-event.clientY)/canvas.height-1, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1)-radius,
                    2*(canvas.height-event.clientY)/canvas.height-1, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1),
                     (2*(canvas.height-event.clientY)/canvas.height-1)-radius, layer, 1.0),
                
                vec4((2*event.clientX/canvas.width-1)+radius*Math.sqrt(2)/2,
                     (2*(canvas.height-event.clientY)/canvas.height-1)+radius*Math.sqrt(2)/2, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1)+radius*Math.sqrt(2)/2,
                     (2*(canvas.height-event.clientY)/canvas.height-1)-radius*Math.sqrt(2)/2, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1)-radius*Math.sqrt(2)/2,
                    (2*(canvas.height-event.clientY)/canvas.height-1)+radius*Math.sqrt(2)/2, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1)-radius*Math.sqrt(2)/2,
                     (2*(canvas.height-event.clientY)/canvas.height-1)-radius*Math.sqrt(2)/2, layer, 1.0),
                
                vec4((2*event.clientX/canvas.width-1)+radius/2,
                     (2*(canvas.height-event.clientY)/canvas.height-1)+radius*Math.sqrt(3)/2, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1)+radius*Math.sqrt(3)/2,
                     (2*(canvas.height-event.clientY)/canvas.height-1)-radius/2, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1)-radius/2,
                    (2*(canvas.height-event.clientY)/canvas.height-1)+radius*Math.sqrt(3)/2, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1)-radius/2,
                     (2*(canvas.height-event.clientY)/canvas.height-1)-radius*Math.sqrt(3)/2, layer, 1.0),

                vec4((2*event.clientX/canvas.width-1)+radius*Math.sqrt(3)/2,
                     (2*(canvas.height-event.clientY)/canvas.height-1)+radius/2, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1)+radius/2,
                     (2*(canvas.height-event.clientY)/canvas.height-1)-radius*Math.sqrt(3)/2, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1)-radius*Math.sqrt(3)/2,
                    (2*(canvas.height-event.clientY)/canvas.height-1)+radius/2, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1)-radius*Math.sqrt(3)/2,
                     (2*(canvas.height-event.clientY)/canvas.height-1)-radius/2, layer, 1.0),
            ]

            gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 16 * index, flatten(vertices));
            gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 16 * index, flatten(color));

            index = index + 16;
            numIndices[numPolygons]++;
        }
    });

    canvas.addEventListener("mousemove", function drawShape(event) {
        if(mouseClicked && isShape){
            var color = new Array(4);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);

            if (!colorPicker){
                for (var i = 0; i < color.length ; i++) 
                {
                    color[i] = vec4(colors[cindex]);
                }
            }
            else {
                for (var i = 0; i < color.length ; i++) 
                {
                    color[i] = lineColor;
                }
            }

            if (shapeNo == 0){}
            
            if (shapeNo == 1){}

            if (shapeNo == 2){}
        }
    });

    var shapeList = document.getElementById("shapes");
    shapeList.addEventListener("click", function() {
        isShape = true;
        shapeNo = shapeList.selectedIndex;
    });

    var brushButton = document.getElementById("brushButton");
    brushButton.addEventListener("click", function() {
        brush = true;
        isShape = false;
    });

    var eraser = document.getElementById("eraserButton");
    eraser.addEventListener("click", function() {
        brush = false;
        isShape = false;
    });

    canvas.addEventListener("mousemove", function erase(event) {
        if(mouseClicked && !brush && !isShape){
            index = index - 16;
            numIndices[numPolygons]--;
        }
    });

    var layerchosen = false;
    var layers = document.getElementById("layers");
    layers.addEventListener("click", function() {
        layerNo = layers.selectedIndex;
        layerchosen = true;
        // near
        if (layerNo == 0)
            layer = 0.2;

        if (layerNo == 1)
            layer = 0.4;

        if (layerNo == 2)
            layer = 0.6;
        // far
        if (layerNo == 3)
            layer = 0.8;
    });

    var upButton = document.getElementById("upButton");
    upButton.addEventListener("click", function() {
        if (layerchosen && layerNo != 0) {
            // switch layer names
            var temp;
            switch(layerNo) {
                case 1:
                    temp = document.getElementById("layer1").innerHTML;
                    document.getElementById("layer1").innerHTML = document.getElementById("layer2").innerHTML ;
                    document.getElementById("layer2").innerHTML = temp;
                    break;
                case 2:
                    temp = document.getElementById("layer3").innerHTML;
                    document.getElementById("layer3").innerHTML = document.getElementById("layer2").innerHTML;
                    document.getElementById("layer2").innerHTML = temp;
                    break;
                case 3:
                    temp = document.getElementById("layer4").innerHTML;
                    document.getElementById("layer4").innerHTML = document.getElementById("layer3").innerHTML;
                    document.getElementById("layer3").innerHTML = temp;
                    break;
            }
        }
    });

    var downButton = document.getElementById("downButton");
    downButton.addEventListener("click", function() {
        if (layerchosen && layerNo != 3) {
            // switch layer names
            var temp;
            switch(layerNo) {
                case 0:
                    temp = document.getElementById("layer1").innerHTML;
                    document.getElementById("layer1").innerHTML = document.getElementById("layer2").innerHTML ;
                    document.getElementById("layer2").innerHTML = temp;
                    break;
                case 1:
                    temp = document.getElementById("layer3").innerHTML;
                    document.getElementById("layer3").innerHTML = document.getElementById("layer2").innerHTML;
                    document.getElementById("layer2").innerHTML = temp;
                    break;
                case 2:
                    temp = document.getElementById("layer4").innerHTML;
                    document.getElementById("layer4").innerHTML = document.getElementById("layer3").innerHTML;
                    document.getElementById("layer3").innerHTML = temp;
                    break;
            }
        }
    });

    gl.enable(gl.DEPTH_TEST);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.8, 0.8, 0.8, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    //
    //  Load shaders and initialize attribute buffers
    //
    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);


    var cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 16 * maxNumVertices, gl.STATIC_DRAW);

    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    var vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 8 * maxNumVertices, gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    render();
}

function render() {
    if (capture) {
        capture = false;

        var image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
        window.location.href=image;
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (var i = 0; i <= numPolygons; i++) {
        if (!isShape)
            gl.drawArrays(gl.TRIANGLE_STRIP, start[i], numIndices[i]*16);
        else {
            if (shapeNo == 0){}
            //gl.drawArrays(gl.TRIANGLE_STRIP, start[i], numIndices[i]*4);
            if (shapeNo == 1){}

            if (shapeNo == 2){}
        }
    }
    requestAnimFrame(render);
}
