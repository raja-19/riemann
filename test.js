var vertSource = 
`#version 300 es

precision mediump float;

in vec3 vertPos;

uniform mat4 mvp;

void main() {
    gl_Position = mvp * vec4(vertPos, 1.0);
}`

var fragSource = 
`#version 300 es

precision mediump float;

out vec4 fragColor;

uniform vec3 eye, dir, up;

uniform float W, H;

struct Sphere {
    vec3 center;
    float radius;
};

Sphere s = Sphere(vec3(0.0, 0.0, 1.0), 1.0);

float hitFloor(vec3 source, vec3 ray) {
    float b = dot(source, up);
    float k = dot(ray, up);
    if (k == 0.0) return -1.0;
    float t = -b / k;
    return t;
}

float hitSphere(vec3 source, vec3 ray, Sphere s) {
    float a = dot(ray, ray);
    float b = 2.0 * dot(ray, source - s.center);
    float c = dot(source - s.center, source - s.center) - s.radius * s.radius;
    float D = b * b - 4.0 * a * c;
    if (D < 0.0) return -1.0;
    float t1 = (-b - sqrt(D)) / (2.0 * a);
    float t2 = (-b + sqrt(D)) / (2.0 * a);
    if (length(s.center - eye) > s.radius && t1 >= 0.0) return t1; 
    if (length(s.center - eye) < s.radius && t2 >= 0.0) return t2; 
    return -1.0;
}

void main() {
    vec2 coord = 0.5 * (gl_FragCoord.xy - vec2(W, H) * 0.5) / W;

    vec3 i = normalize(cross(dir, up));
    vec3 j = normalize(cross(i, dir));

    vec3 ray = normalize(dir + i * coord.x + j * coord.y);

    float t = hitSphere(eye, ray, s);

    if (t < 0.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec3 p = eye + ray * t;
    ray = normalize(p - (s.center + up * s.radius));

    t = hitFloor(p, ray);

    if (t < 0.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    p = p + ray * t;

    float val = sign(sin(4.0 * p.x) * sin(4.0 * p.y));
    fragColor = vec4(0.0, max(0.0, val), max(0.0, -val), 1.0);

}`

var W = document.getElementById("myCanvas").offsetWidth;
var H = document.getElementById("myCanvas").offsetHeight;

var eye = glMatrix.vec3.fromValues(-10, 0, 1);
var dir = glMatrix.vec3.fromValues(1, 0, 0);
var up = glMatrix.vec3.fromValues(0, 0, 1);

var phi = 90.0, psi = 0.0;
var speed = 0.01, sens = 0.1;

var demo = function() {
    var canvas = document.getElementById('myCanvas'); 
    var gl = canvas.getContext('webgl2');
    
    if (!gl) {
        alert("Your browser does not support WebGL2");
    }

    //Shaders

    var vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertSource);
    gl.compileShader(vertShader);

    if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
        console.error("VERTEX SHADER COMPILATION ERROR", gl.getShaderInfoLog(vertShader));
        return;
    }

    var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragSource);
    gl.compileShader(fragShader);

    if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
        console.error("FRAGMENT SHADER COMPILATION ERROR", gl.getShaderInfoLog(fragShader));
        return;
    }

    var program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("PROGRAM LINKING ERROR", gl.getProgramInfoLog(program));
        return;
    }

    //BOs
    var verts = [
       0.0,  0.5,  0.5, 
       0.0, -0.5,  0.5, 
       0.0, -0.5, -0.5, 
       0.0,  0.5, -0.5 
    ];

    var elems = [
        0, 1, 2,
        2, 3, 0
    ];

    var VBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, VBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

    var vertPosLoc = gl.getAttribLocation(program, 'vertPos');
    gl.vertexAttribPointer(vertPosLoc, 3, gl.FLOAT, gl.FALSE, 3 * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.enableVertexAttribArray(vertPosLoc);

    var EBO = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, EBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(elems), gl.STATIC_DRAW);

    //events

    var wasd = [false, false, false, false, false, false];


    var move = function() {
        var d = glMatrix.vec3.create();
        glMatrix.vec3.cross(d, dir, up);
        glMatrix.vec3.normalize(d, d);

        var s = glMatrix.vec3.create();
        glMatrix.vec3.cross(s, d, up);
        glMatrix.vec3.normalize(s, s);

        var a = glMatrix.vec3.create();
        glMatrix.vec3.cross(a, up, dir);
        glMatrix.vec3.normalize(a, a);

        var w = glMatrix.vec3.create();
        glMatrix.vec3.cross(w, up, d);
        glMatrix.vec3.normalize(w, w);

        var down = glMatrix.vec3.fromValues(0.0, 0.0, -1.0);

        var delta = glMatrix.vec3.fromValues(0, 0, 0);

        if (wasd[0]) glMatrix.vec3.add(delta, delta, w);
        if (wasd[1]) glMatrix.vec3.add(delta, delta, a);
        if (wasd[2]) glMatrix.vec3.add(delta, delta, s);
        if (wasd[3]) glMatrix.vec3.add(delta, delta, d);
        if (wasd[4]) glMatrix.vec3.add(delta, delta, up);
        if (wasd[5]) glMatrix.vec3.add(delta, delta, down);

        glMatrix.vec3.scale(delta, delta, speed);
        glMatrix.vec3.add(eye, eye, delta);
    };


    var keyDown = function(event) {
        if (event.key == 'w') wasd[0] = true;
        if (event.key == 'a') wasd[1] = true;
        if (event.key == 's') wasd[2] = true;
        if (event.key == 'd') wasd[3] = true;
        if (event.key == ' ') wasd[4] = true;
        if (event.key == 'Shift') wasd[5] = true;
    };

    var keyUp = function(event) {
        if (event.key == 'w') wasd[0] = false;
        if (event.key == 'a') wasd[1] = false;
        if (event.key == 's') wasd[2] = false;
        if (event.key == 'd') wasd[3] = false;
        if (event.key == ' ') wasd[4] = false;
        if (event.key == 'Shift') wasd[5] = false;

        if (event.key == 'ArrowUp') speed *= 2;
        if (event.key == 'ArrowDown') speed /= 2;
    };

    //setup
    
    var mouseMove = function(event) {
        var x = event.movementX, y = event.movementY;

        phi += sens * (y);
        psi += sens * (-x);
        phi = Math.max(1, phi);
        phi = Math.min(179, phi);

        dir[0] = Math.sin(glMatrix.glMatrix.toRadian(phi)) * Math.cos(glMatrix.glMatrix.toRadian(psi));
        dir[1] = Math.sin(glMatrix.glMatrix.toRadian(phi)) * Math.sin(glMatrix.glMatrix.toRadian(psi));
        dir[2] = Math.cos(glMatrix.glMatrix.toRadian(phi));

        glMatrix.vec3.normalize(dir, dir);

        prevy = y, prevx = x;
    }

    document.addEventListener("pointerlockchange", function(event) {
        if (document.pointerLockElement == canvas) {
            document.addEventListener('mousemove', mouseMove);
            document.addEventListener('keydown', keyDown);
            document.addEventListener('keyup', keyUp);
        } else {
            document.removeEventListener('mousemove', mouseMove);
            document.removeEventListener('keydown', keyDown);
            document.removeEventListener('keyup', keyUp);
        }
    });
    
    canvas.onclick = function() {
        canvas.requestPointerLock();
    };

    var WLoc = gl.getUniformLocation(program, 'W');
    var HLoc = gl.getUniformLocation(program, 'H');

    var eyeLoc = gl.getUniformLocation(program, 'eye');
    var dirLoc = gl.getUniformLocation(program, 'dir');
    var upLoc = gl.getUniformLocation(program, 'up');

    var mvpLoc = gl.getUniformLocation(program, 'mvp');

    var realEye = glMatrix.vec3.fromValues(-1.0, 0, 0); 
    var realCenter = glMatrix.vec3.fromValues(0, 0, 0); 
    var realUp = glMatrix.vec3.fromValues(0, 0, 1);
    
    //loop
    var loop = function() {
        var model = glMatrix.mat4.create();
        var view = glMatrix.mat4.create();
        var proj = glMatrix.mat4.create();

        glMatrix.mat4.identity(model);
        glMatrix.mat4.lookAt(view, realEye, realCenter, realUp);
        glMatrix.mat4.perspective(proj, glMatrix.glMatrix.toRadian(45.0), 1.0, 0.1, 100.0);

        var mvp = glMatrix.mat4.create();

        glMatrix.mat4.mul(mvp, view, model);
        glMatrix.mat4.mul(mvp, proj, mvp);

        gl.uniformMatrix4fv(mvpLoc, gl.FALSE, mvp);

        move();
        
        gl.uniform3fv(eyeLoc, eye);
        gl.uniform3fv(dirLoc, dir);
        gl.uniform3fv(upLoc, up);


        gl.uniform1f(WLoc, W);
        gl.uniform1f(HLoc, H);

        gl.clearColor(0.7, 0.2, 0.5, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        requestAnimationFrame(loop);
    }

    gl.useProgram(program);
    requestAnimationFrame(loop);
}

window.onload = demo;
