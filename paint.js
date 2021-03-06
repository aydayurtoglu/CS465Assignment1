"use strict";

var canvas;
var vcp;
var gl;

var maxNumVertices = 200000;
var index = 0;

var cindex = 0;
var strokeIndex = 0;
var vertices;
var deletedVertices = [];
var colors = [
  vec4(0.0, 0.0, 0.0, 1.0), // black
  vec4(1.0, 0.0, 0.0, 1.0), // red
  vec4(1.0, 1.0, 0.0, 1.0), // yellow
  vec4(0.0, 1.0, 0.0, 1.0), // green
  vec4(0.0, 1.0, 1.0, 1.0), // cyan
  vec4(0.0, 0.0, 1.0, 1.0), // blue
  vec4(1.0, 0.0, 1.0, 1.0), // magenta
  vec4(0.0, 0.0, 0.0, 0.0) // white
];
var t, t1, t2, t3, t4, t5, t6;
var first = true;
var numStrokes = 0;
var numPolygons = 0;
var numIndices = [];
numIndices[0] = 0;
var start = [0];
var startStrokes = [0];
var finishStrokes = [0];
var colorCpy = [];

var undoIndices = [10];
var undoNo = 0;

var mouseClicked = false;
var capture = false;
var lineColor;
var colorPicker = false;

var isShape = false;
var shapeNo;
var brush = true;
var layerNo = 3;
var layer = 0.8;
var count;
var isFilled = true;
var points = [];
var subPoints = [];
var options;
var fileSize;

window.onload = function init() {
    localStorage.clear();

    canvas = document.getElementById("gl-canvas");
    options = document.getElementById("storage");
    // visual color picker
    vcp = document.getElementById("colorpicker");
    var ctx = vcp.getContext("2d");

    /*
        This function was taken from https://stackoverflow.com/questions/41524641/draw-saturation-brightness-gradient
        It converts RGB values to HSL values.
    */
    function rgbToHSL(red, green, blue, result = {}) {
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

    /*
        This function was taken from https://stackoverflow.com/questions/41524641/draw-saturation-brightness-gradient
        It draws a gradient on the visual color picker by taking the rgb value from the hue picker.
    */
    function drawGradient(r, g, b) {
        var col = rgbToHSL(r, g, b);
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

    // Display hue.png on a canvas
    drawGradient(0, 0, 0);
    var huecanvas = document.getElementById("huepicker");
    var huectx = huecanvas.getContext("2d");

    let gradient = huectx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, 'red');
    gradient.addColorStop(0.15, 'orange');
    gradient.addColorStop(0.3, 'yellow');
    gradient.addColorStop(0.5, '#00FF00');
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

    gl = canvas.getContext("experimental-webgl", {preserveDrawingBuffer: true});
    if (!gl) {
        alert("WebGL isn't available");
    }

    var option = document.getElementById("mymenu");
    option.addEventListener("click", function() {
        cindex = option.selectedIndex;
        colorPicker = false;

        drawGradient(colors[cindex][0], colors[cindex][1], colors[cindex][2]);
    });

    var clearButton = document.getElementById("clearButton")
    clearButton.addEventListener("click", function (){
        clearCanvas();
    });

    /*
        Clear the whole canvas and the corresponding data
    */
    function clearCanvas(){
        index = 0;
        numPolygons = 0;
        numIndices = [];
        numIndices[0] = 0;
        start = [0];
        subPoints = [];
    }

    var undo = document.getElementById("undoButton")
    undo.addEventListener("click", function undo(){
        
        if (undoNo == 10)
            return;

        else { //mark noOfIndices and starting indexes of undone stroke
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
        fileSize = subPoints.length * 2;
        points.push(fileSize);

        if(!document.getElementById("saveName").value)
        {
            alert("Please enter file name!");
            return;
        }

        var fileName = document.getElementById("saveName").value;
        localStorage.setItem(fileName, JSON.stringify(points));
        loadFileNames();
    });
    
    var load = document.getElementById("loadButton")
    load.addEventListener("click", function save(){
        if(options.selectedIndex == -1)
        {
            alert("No saved file!");
            return;
        }

        var fileName = options[options.selectedIndex].text;
        var result = localStorage.getItem(fileName);

        if(!result)
        {
            alert("No result found for '" + fileName + "'");
        }
        else
        {
            result = JSON.parse(result);
            generatePoints(result);
        }    
    });

    /*
        Load saved points
    */
    function generatePoints(value)
    {
        clearCanvas();

        var vertexNo = value[value.length-1];
        
        for(var i = value.length-2; i > value.length-2-vertexNo; i-=2){
            gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 16 * index, flatten(value[i]));

            var j = i-1;

            if (j > 0) {
                gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
                gl.bufferSubData(gl.ARRAY_BUFFER, 16 * index, flatten(value[j]));
            }

            index += 24;
            numIndices[numPolygons]++;
        }
    }

    canvas.addEventListener("mousedown", function draw(event){
        mouseClicked = true;
        undoNo = 0;

        //Drawing a rectangle
        if (isShape){
            gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer)
            t1 = vec4(2*event.clientX/canvas.width-1, 
                2*(canvas.height-event.clientY)/canvas.height-1, layer, 1.0);        
        }
        else{
            numStrokes++;
            startStrokes[numStrokes] = index;
        }

        numPolygons++;
        numIndices[numPolygons] = 0;
        start[numPolygons] = index;
    });
  
    canvas.addEventListener("mouseup", function release(event){
        mouseClicked = false;

        if(isShape && shapeNo == 0){   
            if (isFilled)
                index += 6;
            else
                index += 8;
        }
        if(isShape && shapeNo == 1){   
            if (isFilled)
                index += count;
            else
                index += count;
        }
        else if (isShape && shapeNo == 2){
            if (isFilled)
                index += 3;
            else
                index += 6;
        }
        else {
            finishStrokes[numStrokes] = index;
        }
    });
  
    /*
        Draw brush strokes
    */
    canvas.addEventListener("mousemove", function stroke(event) {
        if(mouseClicked && !isShape && brush){
            var color = new Array(24);
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

            t = vec2(2*event.clientX/canvas.width-1, 2*(canvas.height-event.clientY)/canvas.height-1);
        
            vertices = [ // draw four squares on top of each other with different angles to create a round brush
                vec4(t[0], t[1]+radius, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1)+radius,
                    2*(canvas.height-event.clientY)/canvas.height-1, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1)-radius,
                    2*(canvas.height-event.clientY)/canvas.height-1, layer, 1.0),
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
                vec4((2*event.clientX/canvas.width-1)+radius/2,
                    (2*(canvas.height-event.clientY)/canvas.height-1)-radius*Math.sqrt(3)/2, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1)-radius*Math.sqrt(3)/2,
                   (2*(canvas.height-event.clientY)/canvas.height-1)+radius/2, layer, 1.0),
                vec4((2*event.clientX/canvas.width-1)-radius*Math.sqrt(3)/2,
                    (2*(canvas.height-event.clientY)/canvas.height-1)-radius/2, layer, 1.0),
            ]

            deletedVertices = deletedVertices.concat(vertices);
            colorCpy = colorCpy.concat(color);

            points.push(color);
            points.push(vertices);
            subPoints.push(vertices);

            gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 16 * index, flatten(vertices));
            gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 16 * index, flatten(color));

            index += 24;
            numIndices[numPolygons]++;
        }
    });

    /*
        Draw shapes
    */
    canvas.addEventListener("mousemove", function drawShape(event) {
        if(mouseClicked && isShape){
            var color = new Array(6);
            
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

            if (shapeNo == 0){
                t2 = vec4(2*event.clientX/canvas.width-1, 
                    2*(canvas.height-event.clientY)/canvas.height-1, layer, 1.0 ); //right bottom

                t3 = vec4(t1[0], t2[1], layer, 1.0); //left bottom 
                t4 = vec4(t2[0], t1[1], layer, 1.0); //right top 

                if (isFilled) {
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*index, flatten(t1));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+1), flatten(t3));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+2), flatten(t2));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+3), flatten(t2));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+4), flatten(t1));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+5), flatten(t4));

                    gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer);

                    for (var i = 0; i < 6; i++)
                        gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+i), flatten(color));
                }
                else {
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*index, flatten(t1));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+1), flatten(t3));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+2), flatten(t3));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+3), flatten(t2));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+4), flatten(t2));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+5), flatten(t4));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+6), flatten(t4));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+7), flatten(t1));
                    
                    gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer);

                    for (var i = 0; i < 8; i++)
                        gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+i), flatten(color));
                }
                numIndices[numPolygons]++;
            } 
            else if (shapeNo == 1){
                
                if (isFilled){
                    t2 = vec4(2*event.clientX/canvas.width-1, 
                        2*(canvas.height-event.clientY)/canvas.height-1, layer, 1.0 );

                    var rSquare, r, centerX, centerY;

                    rSquare = (t2[0] - t1[0]) ** 2 + (t2[1] - t1[1]) ** 2;
                    r = Math.sqrt(rSquare);
                    centerX = (t1[0] + t2[0]) / 2;
                    centerY = (t1[1] + t2[1]) / 2;
                    
                    count = 0;

                    // t2 > t1
                    for (var x = t1[0]; x <= t2[0]; x += 0.05) {
                        for (var y = t1[1]; y <= t2[1]; y += 0.05) {
                            if ( ((x - centerX) ** 2) + ((y - centerY) ** 2) <= rSquare ) {
                                t3 = vec4( x, y, layer, 1.0);
                                gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+count), flatten(t3));
                                count++;
                            }
                        }
                    }

                    count = 0;
                    gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer);

                    for (var x = t1[0]; x <= t2[0]; x += 0.05) {
                        for (var y = t1[1]; y <= t2[1]; y += 0.05) {
                            if ( ((x - centerX) ** 2) + ((y - centerY) ** 2) <= rSquare ) {
                                gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+count), flatten(color));
                                count++;
                            }
                        }
                    }
                }
                else {


                }
                numIndices[numPolygons]++;
                
            }
            else if (shapeNo == 2){
                t2 = vec4(2*event.clientX/canvas.width-1, 
                    2*(canvas.height-event.clientY)/canvas.height-1, layer, 1.0 );
                t3 = vec4(t1[0]-t2[0], t2[1], layer, 1.0);

                if (isFilled){
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*index, flatten(t1));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+1), flatten(t3));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+2), flatten(t2));
                    
                    gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer);
                    for (var i = 0; i < 3; i++)
                        gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+i), flatten(color));
                }
                else{
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*index, flatten(t1));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+1), flatten(t3));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+2), flatten(t3));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+3), flatten(t2));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+4), flatten(t2));
                    gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+5), flatten(t1));
                    
                    gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer);
                    
                    for (var i = 0; i < 6; i++)
                        gl.bufferSubData(gl.ARRAY_BUFFER, 16*(index+i), flatten(color));
                }
                numIndices[numPolygons]++;
            }
            layer = layer - 0.00001;
        }
    });

    var shapeList = document.getElementById("shapes");
    shapeList.addEventListener("click", function() {
        isShape = true;
        shapeNo = shapeList.selectedIndex;
    });

    var fillTypes = document.getElementById("filltype");
    fillTypes.addEventListener("click", function() {
        if (fillTypes.selectedIndex == 0)
            isFilled = true;
        else
            isFilled = false;
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

    /*
        Erase vertices
    */
    canvas.addEventListener("mousemove", function erase(event) {
        if(mouseClicked && !brush && !isShape){
            var radius = 0.04;
            layer = layer - 0.00001;

            t = vec2(2*event.clientX/canvas.width-1, 2*(canvas.height-event.clientY)/canvas.height-1);

            for (var i = 0; i < numStrokes; i++){
                for (var j = startStrokes[i]; j < finishStrokes[i]; j+=24){
                    var distance = Math.sqrt( Math.pow(deletedVertices[j][0]-t[0], 2)+ Math.pow(deletedVertices[j][1]-t[1], 2));
                    if (distance < radius){
                        deletedVertices.splice(j, 24);
                        colorCpy.splice(j, 24);
                        j-=24;
                        finishStrokes[i]-=24;
                        index-=24;
                        numIndices[numPolygons]--;
                    }
                }
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(deletedVertices));
            gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(colorCpy));
        }
    });

    var layerchosen = false;
    var layers = document.getElementById("layers");
    layers.addEventListener("click", function() {
        layerNo = layers.selectedIndex;
        layerchosen = true;
        layer = (2 ** layerNo) / 10.0;
    });

    var upButton = document.getElementById("upButton");
    upButton.addEventListener("click", function() {
        if (layerchosen && layerNo != 0) {
            // switch layer names
            var temp;
            switch(layerNo) {
                case 1:
                    temp = document.getElementById("layer1").innerHTML;
                    document.getElementById("layer1").innerHTML = document.getElementById("layer2").innerHTML;
                    document.getElementById("layer2").innerHTML = temp;
                    switchLayers(0,1);
                    break;
                case 2:
                    temp = document.getElementById("layer3").innerHTML;
                    document.getElementById("layer3").innerHTML = document.getElementById("layer2").innerHTML;
                    document.getElementById("layer2").innerHTML = temp;
                    switchLayers(1,2);
                    break;
                case 3:
                    temp = document.getElementById("layer4").innerHTML;
                    document.getElementById("layer4").innerHTML = document.getElementById("layer3").innerHTML;
                    document.getElementById("layer3").innerHTML = temp;
                    switchLayers(2,3);
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
                    switchLayers(0,1);
                    break;
                case 1:
                    temp = document.getElementById("layer3").innerHTML;
                    document.getElementById("layer3").innerHTML = document.getElementById("layer2").innerHTML;
                    document.getElementById("layer2").innerHTML = temp;
                    switchLayers(1,2);
                    break;
                case 2:
                    temp = document.getElementById("layer4").innerHTML;
                    document.getElementById("layer4").innerHTML = document.getElementById("layer3").innerHTML;
                    document.getElementById("layer3").innerHTML = temp;
                    switchLayers(2,3);
                    break;
            }
        }
    });

    /*
        Change the z-coordinates of the points to switch between layers
    */
    function switchLayers(layer1, layer2) {
        var z1 = (2 ** layer1) / 10.0;
        var z2 = (2 ** layer2) / 10.0;

        clearCanvas();
        var newPoints = [];

        for(var i = points.length-1; i > 0; i-=2){
            if ( points[i][0][2] <= z1 && points[i][0][2] > z1-0.01){
                for (var k = 0; k < 24; k++)
                    points[i][k][2] = z2; // change the z coordinate of the vertex
            }
            else if ( points[i][0][2] <= z2 && points[i][0][2] > z2-0.01){
                for (var k = 0; k < 24; k++)
                    points[i][k][2] = z1; // change the z coordinate of the vertex
            }
            newPoints.push(points[i-1]); // push the color
            newPoints.push(points[i]); // push the new vertex

            z2 -= 0.000001;
            z1 -= 0.000001;
        }

        // display new points
        for(var i = newPoints.length-1; i > 0; i-=2){ 
            gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 16 * index, flatten(newPoints[i]));

            gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 16 * index, flatten(newPoints[i-1]));
            
            index += 24;
            numIndices[numPolygons]++;
        }
    }

    // show saved file names
    function loadFileNames()
    {
        options.innerHTML = "";
        for(var i = 0; i < Object.keys(localStorage).length; i++)
        {
            var option = document.createElement("option");
            option.value = i;
            option.innerHTML = Object.keys(localStorage)[i];
            options.appendChild(option);
        }
    }

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
        if (!isShape) // brush is used
            gl.drawArrays(gl.TRIANGLES, start[i], numIndices[i]*24);
        else {
            // shape is rectangle
            if (shapeNo == 0) {
                if (isFilled)
                    gl.drawArrays(gl.TRIANGLES, start[i], numIndices[i]*16);
                else if (!isFilled)
                    gl.drawArrays(gl.LINES, start[i], numIndices[i]*16);
            }
            // shape is ellipse
            if (shapeNo == 1){
                if (isFilled)
                    gl.drawArrays(gl.LINES, start[i], numIndices[i]*count);
                else if (!isFilled)
                    gl.drawArrays(gl.LINES, start[i], numIndices[i]*count);
            }
            // shape is triangle
            if (shapeNo == 2){
                if (isFilled)
                    gl.drawArrays(gl.TRIANGLES, start[i], numIndices[i]*16);
                else if (!isFilled)
                    gl.drawArrays(gl.LINES, start[i], numIndices[i]*16);
            }
        }
        
    }
    requestAnimFrame(render);
}
