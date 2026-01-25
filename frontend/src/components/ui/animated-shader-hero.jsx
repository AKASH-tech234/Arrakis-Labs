import React, { useRef, useEffect } from "react";

const defaultShaderSource = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 resolution;
uniform float time;
#define FC gl_FragCoord.xy
#define T time
#define R resolution
#define MN min(R.x,R.y)
float rnd(vec2 p) {
  p=fract(p*vec2(12.9898,78.233));
  p+=dot(p,p+34.56);
  return fract(p.x*p.y);
}
float noise(in vec2 p) {
  vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
  float
  a=rnd(i),
  b=rnd(i+vec2(1,0)),
  c=rnd(i+vec2(0,1)),
  d=rnd(i+1.);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm(vec2 p) {
  float t=.0, a=1.; mat2 m=mat2(1.,-.5,.2,1.2);
  for (int i=0; i<5; i++) {
    t+=a*noise(p);
    p*=2.*m;
    a*=.5;
  }
  return t;
}
float clouds(vec2 p) {
  float d=1., t=.0;
  for (float i=.0; i<3.; i++) {
    float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);
    t=mix(t,d,a);
    d=a;
    p*=2./(i+1.);
  }
  return t;
}
void main(void) {
  vec2 uv=(FC-.5*R)/MN,st=uv*vec2(2,1);
  vec3 col=vec3(0);
  float bg=clouds(vec2(st.x+T*.5,-st.y));
  uv*=1.-.3*(sin(T*.2)*.5+.5);
  for (float i=1.; i<12.; i++) {
    uv+=.1*cos(i*vec2(.1+.01*i, .8)+i*i+T*.5+.1*uv.x);
    vec2 p=uv;
    float d=length(p);
    col+=.00125/d*(cos(sin(i)*vec3(1,2,3))+1.);
    float b=noise(i+p+bg*1.731);
    col+=.002*b/length(max(p,vec2(b*p.x*.02,p.y)));
    col=mix(col,vec3(bg*.25,bg*.137,bg*.05),d);
  }
  O=vec4(col,1);
}`;

class WebGLRenderer {
  constructor(canvas, scale) {
    this.canvas = canvas;
    this.scale = scale;
    this.gl = canvas.getContext("webgl2");
    this.program = null;
    this.vs = null;
    this.fs = null;
    this.buffer = null;
    this.shaderSource = defaultShaderSource;
    this.mouseMove = [0, 0];
    this.mouseCoords = [0, 0];
    this.pointerCoords = [0, 0];
    this.nbrOfPointers = 0;

    this.vertexSrc = `#version 300 es
precision highp float;
in vec4 position;
void main(){gl_Position=position;}`;

    this.vertices = [-1, 1, -1, -1, 1, 1, 1, -1];

    if (this.gl) {
      this.gl.viewport(0, 0, canvas.width * scale, canvas.height * scale);
    }
  }

  updateShader(source) {
    this.reset();
    this.shaderSource = source;
    this.setup();
    this.init();
  }

  updateMove(deltas) {
    this.mouseMove = deltas;
  }

  updateMouse(coords) {
    this.mouseCoords = coords;
  }

  updatePointerCoords(coords) {
    this.pointerCoords = coords;
  }

  updatePointerCount(nbr) {
    this.nbrOfPointers = nbr;
  }

  updateScale(scale) {
    this.scale = scale;
    if (this.gl) {
      this.gl.viewport(
        0,
        0,
        this.canvas.width * scale,
        this.canvas.height * scale
      );
    }
  }

  compile(shader, source) {
    const gl = this.gl;
    if (!gl) return;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
  }

  test(source) {
    let result = null;
    const gl = this.gl;
    if (!gl) return result;
    const shader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      result = gl.getShaderInfoLog(shader);
    }
    gl.deleteShader(shader);
    return result;
  }

  reset() {
    const gl = this.gl;
    if (!gl) return;
    if (
      this.program &&
      !gl.getProgramParameter(this.program, gl.DELETE_STATUS)
    ) {
      if (this.vs) {
        gl.detachShader(this.program, this.vs);
        gl.deleteShader(this.vs);
      }
      if (this.fs) {
        gl.detachShader(this.program, this.fs);
        gl.deleteShader(this.fs);
      }
      gl.deleteProgram(this.program);
    }
  }

  setup() {
    const gl = this.gl;
    if (!gl) return;
    this.vs = gl.createShader(gl.VERTEX_SHADER);
    this.fs = gl.createShader(gl.FRAGMENT_SHADER);
    this.compile(this.vs, this.vertexSrc);
    this.compile(this.fs, this.shaderSource);
    this.program = gl.createProgram();
    gl.attachShader(this.program, this.vs);
    gl.attachShader(this.program, this.fs);
    gl.linkProgram(this.program);
  }

  init() {
    const gl = this.gl;
    const program = this.program;
    if (!gl || !program) return;

    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(this.vertices),
      gl.STATIC_DRAW
    );

    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    program.resolution = gl.getUniformLocation(program, "resolution");
    program.time = gl.getUniformLocation(program, "time");
    program.move = gl.getUniformLocation(program, "move");
    program.touch = gl.getUniformLocation(program, "touch");
    program.pointerCount = gl.getUniformLocation(program, "pointerCount");
    program.pointers = gl.getUniformLocation(program, "pointers");
  }

  render(now = 0) {
    const gl = this.gl;
    const program = this.program;

    if (!gl || !program || gl.getProgramParameter(program, gl.DELETE_STATUS))
      return;

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

    gl.uniform2f(program.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(program.time, now * 1e-3);
    gl.uniform2f(program.move, ...this.mouseMove);
    gl.uniform2f(program.touch, ...this.mouseCoords);
    gl.uniform1i(program.pointerCount, this.nbrOfPointers);
    gl.uniform2fv(program.pointers, this.pointerCoords);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

class PointerHandler {
  constructor(element, scale) {
    this.scale = scale;
    this.active = false;
    this.pointers = new Map();
    this.lastCoords = [0, 0];
    this.moves = [0, 0];
    this.element = element;

    const map = (el, s, x, y) => [x * s, el.height - y * s];

    element.addEventListener("pointerdown", (e) => {
      this.active = true;
      this.pointers.set(
        e.pointerId,
        map(element, this.scale, e.clientX, e.clientY)
      );
    });

    element.addEventListener("pointerup", (e) => {
      if (this.count === 1) {
        this.lastCoords = this.first;
      }
      this.pointers.delete(e.pointerId);
      this.active = this.pointers.size > 0;
    });

    element.addEventListener("pointerleave", (e) => {
      if (this.count === 1) {
        this.lastCoords = this.first;
      }
      this.pointers.delete(e.pointerId);
      this.active = this.pointers.size > 0;
    });

    element.addEventListener("pointermove", (e) => {
      if (!this.active) return;
      this.lastCoords = [e.clientX, e.clientY];
      this.pointers.set(
        e.pointerId,
        map(element, this.scale, e.clientX, e.clientY)
      );
      this.moves = [this.moves[0] + e.movementX, this.moves[1] + e.movementY];
    });
  }

  updateScale(scale) {
    this.scale = scale;
  }

  get count() {
    return this.pointers.size;
  }

  get move() {
    return this.moves;
  }

  get coords() {
    return this.pointers.size > 0
      ? Array.from(this.pointers.values()).flat()
      : [0, 0];
  }

  get first() {
    return this.pointers.values().next().value || this.lastCoords;
  }
}

const useShaderBackground = () => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef();
  const rendererRef = useRef(null);
  const pointersRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const dpr = Math.max(1, 0.5 * window.devicePixelRatio);

    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      if (rendererRef.current) {
        rendererRef.current.updateScale(dpr);
      }
    };

    const loop = (now) => {
      if (!rendererRef.current || !pointersRef.current) return;

      rendererRef.current.updateMouse(pointersRef.current.first);
      rendererRef.current.updatePointerCount(pointersRef.current.count);
      rendererRef.current.updatePointerCoords(pointersRef.current.coords);
      rendererRef.current.updateMove(pointersRef.current.move);
      rendererRef.current.render(now);
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    rendererRef.current = new WebGLRenderer(canvas, dpr);
    pointersRef.current = new PointerHandler(canvas, dpr);

    rendererRef.current.setup();
    rendererRef.current.init();

    resize();

    if (rendererRef.current.test(defaultShaderSource) === null) {
      rendererRef.current.updateShader(defaultShaderSource);
    }

    loop(0);

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.reset();
      }
    };
  }, []);

  return canvasRef;
};

const AnimatedShaderHero = ({
  trustBadge,
  headline,
  subtitle,
  buttons,
  className = "",
}) => {
  const canvasRef = useShaderBackground();

  return (
    <div
      className={`relative w-full h-screen overflow-hidden ${className}`}
      style={{ backgroundColor: "#0A0A08" }}
    >
      <style>{`
        @keyframes fade-in-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in-down {
          animation: fade-in-down 0.8s ease-out forwards;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
          opacity: 0;
        }
        
        .animation-delay-200 {
          animation-delay: 0.2s;
        }
        
        .animation-delay-400 {
          animation-delay: 0.4s;
        }
        
        .animation-delay-600 {
          animation-delay: 0.6s;
        }
        
        .animation-delay-800 {
          animation-delay: 0.8s;
        }
      `}</style>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-contain touch-none"
        style={{ background: "#0A0A08" }}
      />

      {}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 50%, transparent 0%, rgba(10, 10, 8, 0.4) 100%)",
        }}
      />

      {}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
        {}
        {trustBadge && (
          <div className="mb-10 animate-fade-in-down">
            <div
              className="flex items-center gap-3 px-6 py-3 border border-[#92400E]/30 text-xs tracking-[0.2em] uppercase"
              style={{
                backgroundColor: "rgba(146, 64, 14, 0.1)",
                fontFamily: "'Rajdhani', 'Orbitron', system-ui, sans-serif",
              }}
            >
              <span className="w-1.5 h-1.5 bg-[#F59E0B] animate-pulse" />
              <span className="text-[#E8E4D9]">{trustBadge.text}</span>
            </div>
          </div>
        )}

        <div className="text-center space-y-8 max-w-5xl mx-auto px-6">
          {}
          <div className="space-y-2">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium animate-fade-in-up animation-delay-200"
              style={{
                fontFamily: "'Orbitron', 'Rajdhani', system-ui, sans-serif",
                letterSpacing: "0.1em",
                color: "#E8E4D9",
                textShadow: "0 0 60px rgba(245, 158, 11, 0.2)",
              }}
            >
              {headline.line1}
            </h1>
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium bg-gradient-to-r from-[#92400E] via-[#D97706] to-[#F59E0B] bg-clip-text text-transparent animate-fade-in-up animation-delay-400"
              style={{
                fontFamily: "'Orbitron', 'Rajdhani', system-ui, sans-serif",
                letterSpacing: "0.1em",
              }}
            >
              {headline.line2}
            </h1>
          </div>

          {}
          <div className="max-w-2xl mx-auto animate-fade-in-up animation-delay-600">
            <p
              className="text-sm sm:text-base md:text-lg leading-relaxed"
              style={{
                fontFamily: "'Rajdhani', system-ui, sans-serif",
                letterSpacing: "0.05em",
                color: "#78716C",
              }}
            >
              {subtitle}
            </p>
          </div>

          {}
          {buttons && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12 animate-fade-in-up animation-delay-800">
              {buttons.primary && (
                <a
                  href={buttons.primary.href}
                  className="px-8 py-4 bg-gradient-to-r from-[#92400E] to-[#D97706] hover:from-[#D97706] hover:to-[#F59E0B] text-[#0A0A08] font-semibold text-xs tracking-[0.15em] uppercase transition-all duration-300 hover:shadow-lg hover:shadow-[#F59E0B]/20"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {buttons.primary.text}
                </a>
              )}
              {buttons.secondary && (
                <a
                  href={buttons.secondary.href}
                  className="px-8 py-4 border border-[#92400E]/40 hover:border-[#D97706]/60 text-[#E8E4D9] font-medium text-xs tracking-[0.15em] uppercase transition-all duration-300 hover:bg-[#92400E]/10"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {buttons.secondary.text}
                </a>
              )}
            </div>
          )}
        </div>

        {}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-fade-in-up animation-delay-800">
          <div className="flex flex-col items-center gap-3">
            <span
              className="text-[10px] tracking-[0.2em] uppercase text-[#78716C]"
              style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
            >
              Scroll
            </span>
            <div className="w-px h-8 bg-gradient-to-b from-[#D97706] to-transparent animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimatedShaderHero;
