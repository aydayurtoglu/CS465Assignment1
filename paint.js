"use strict";

var canvas;
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

var undoIndices = [10];
var redoIndices = [10];
//var undoStart = [10];
//var redoStart = [10];
var undoNo = 0;
var redoNo = 0;


var mouseClicked = false;

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert("WebGL isn't available");
    }

    var m = document.getElementById("mymenu");

    m.addEventListener("click", function() {
        cindex = m.selectedIndex;
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
        
        if (undoNo == 10 || (undoNo == 0 && redoNo > 0))
            return;

        else {//mark noOfIndices and starting indexes of undone stroke
            undoIndices[undoNo] = numIndices[numPolygons];
            //undoStart[undoNo] = start[numPolygons];
            //clear info from main arrays
            numIndices[numPolygons] = 0;
            //start[numPolygons] = 0;
            //increase undoNo and decrease numPolygons
            numPolygons--;
            undoNo++;
        }
        

    });

    var redo = document.getElementById("clearButton")
    redo.addEventListener("click", function redo(){
        
        //redo a Stroke by pulling data from redoIndices array
        if (redoNo > 0 && undoNo == 0 ){
            numPolygons++;
            numIndices[numPolygons] = redoIndices[redoNo];
            //start[numPolygons] = redoStart[redoNo];

            redoIndices[redoNo] = 0;
            //redoStart[redoNo] = 0;
            redoNo--;
        }
        //redo a stroke by pulling data from undoIndices array
        else if (undoNo > 0) {
            numPolygons++;
            numIndices[numPolygons] = undoIndices[undoNo];
            //start[numPolygons] = undoStart[redoNo];

            undoIndices[undoNo] = 0;
            //undoStart[redoNo] = 0;
            undoNo--;
        }
        else {
            return;
        }
        
        
    });
  
    canvas.addEventListener("mousedown", function draw(event){
        mouseClicked = true;
        
        for (var i = undoNo; i > 0; i-- ){
            redoIndices[i] = undoIndices[i];
            //redoStart[i] = undoStart[i];
            undoIndices[i] = 0;
            //undoStart[i] = 0;
        }
        redoNo = undoNo;
        undoNo = 0;
        
        numPolygons++;
        numIndices[numPolygons] = 0;
        start[numPolygons] = index;
    });
  
    canvas.addEventListener("mouseup", function release(event){
        mouseClicked = false;

        redoNo = 0;
        redoIndices = [0];
    });
  
    canvas.addEventListener("mousemove", function stroke(event) {
        if(mouseClicked){
            var r = 2000;
            t = vec2(2 * event.clientX / canvas.width - 1,
                2 * (canvas.height - event.clientY) / canvas.height - 1);
            gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
            gl.bufferSubData(gl.ARRAY_BUFFER, 8 * index, flatten(t));

            t = vec4(colors[cindex]);

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
