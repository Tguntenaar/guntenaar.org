var Dt={size:160,gap:0,bevel:1.5,tilt:24,perspective:.5,float:0,speed:1,shine:.5,lift:.1,radius:1200,flow:0,swirl:0,trail:0,iridescence:1,bloom:0,grain:.8,gapColor:"auto"},_t=`#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main () {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`,Mt=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uContent;
uniform vec2 uRes;
uniform float uSize;
uniform float uGap;
uniform float uBevel;
uniform float uTilt;
uniform float uDist;
uniform float uFloat;
uniform float uShine;
uniform float uLift;
uniform float uIrid;
uniform sampler2D uFlow;
uniform vec2 uScroll;
uniform float uTime;
uniform float uHasContent;
uniform float uMaxX;
uniform vec3 uBg;
uniform vec3 uGapColor;

const float TAU = 6.2831853;
const float SQ3 = 1.7320508;

float hash12 (vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hextile (inout vec2 p) {
  const vec2 sz = vec2(1.0, SQ3);
  const vec2 hsz = 0.5 * sz;
  vec2 p1 = mod(p, sz) - hsz;
  vec2 p2 = mod(p - hsz, sz) - hsz;
  vec2 p3 = dot(p1, p1) < dot(p2, p2) ? p1 : p2;
  vec2 n = (p3 - p + hsz) / sz;
  p = p3;
  n -= vec2(0.5);
  return round(n * 2.0) * 0.5;
}

float hexDist (vec2 p) {
  p = abs(p);
  return max(dot(p, vec2(0.5, 0.8660254)), p.x);
}

float flowAt (vec2 xy) {
  vec2 uv = (xy * uSize - uScroll) / uRes;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return clamp(texture(uFlow, uv).r, 0.0, 4.0);
}

float tileZ (vec2 center, float f) {
  vec2 id = center * vec2(1.0, 1.0 / SQ3);
  float h = hash12(id * 7.31 + 3.7);
  float focus = smoothstep(0.18, 0.85, f);
  float ring = smoothstep(0.02, 0.14, f) * (1.0 - smoothstep(0.14, 0.6, f));
  float bob = uFloat * 0.4 * sin(uTime * 1.4 + h * TAU) * (1.0 - focus);
  float lift = uLift * ring;
  return -(bob + lift * 1.2);
}

vec4 page (vec2 px) {
  vec2 p = px / uRes;
  if (p.x < 0.0 || p.x > uMaxX || p.y < 0.0 || p.y > 1.0) return vec4(0.0);
  return texture(uContent, p);
}

vec4 shade (vec2 sUv) {
  float cell = max(uSize, 8.0);
  float hw = max(0.5 - (uGap / cell) * 0.5, 0.15);
  float bevW = clamp(uBevel / cell, 0.0, hw - 0.1);
  float th = 0.09;

  float aspect = uRes.x / uRes.y;
  vec2 ndc = vec2((sUv.x * 2.0 - 1.0) * aspect, sUv.y * 2.0 - 1.0);

  float sa = sin(uTilt);
  float ca = cos(uTilt);
  vec3 fwd = vec3(0.0, -sa, ca);
  vec3 upv = vec3(0.0, ca, sa);
  float H = uRes.y / cell;
  float D = H * uDist;
  float focal = (D + sqrt(D * D + H * H * sa * sa)) / (H * ca);
  float dy = 0.5 * H - sa * D
    - ca * D * (ca - focal * sa) / (sa + focal * ca);
  vec3 la = vec3(uScroll.x / cell + 0.5 * uRes.x / cell,
                 uScroll.y / cell + 0.5 * H + dy, 0.0);
  vec3 ro = la - fwd * D;
  vec3 rd = normalize(vec3(ndc.x, 0.0, 0.0) + ndc.y * upv + focal * fwd);

  vec3 seam = uGapColor;

  if (rd.z < 0.02) {
    return uHasContent > 0.5 ? vec4(uBg, 1.0) : vec4(0.0);
  }

  float maxUp = uFloat * 0.4 + uLift * 1.2 + th;
  float floorZ = th + 0.06;
  float tFloor = (floorZ - ro.z) / rd.z;
  float t0 = max((-maxUp - ro.z) / rd.z, 0.0);

  vec2 oxy = ro.xy;
  vec2 rxy = rd.xy;
  vec2 sp = oxy + rxy * t0;
  vec2 local = sp;
  hextile(local);
  vec2 center = sp - local;

  vec2 N0 = vec2(1.0, 0.0);
  vec2 N1 = vec2(0.5, 0.8660254);
  vec2 N2 = vec2(-0.5, 0.8660254);

  bool hit = false;
  bool onTop = false;
  float tHit = 0.0;
  vec3 n = vec3(0.0, 0.0, -1.0);
  float zc = 0.0;

  float hwc = hw;
  float fCell = 0.0;
  for (int i = 0; i < 64; i++) {
    fCell = flowAt(center);
    zc = tileZ(center, fCell);
    hwc = mix(hw, 0.502, smoothstep(0.18, 0.85, fCell));
    float zTop = zc - th;
    float tZin = (zTop - ro.z) / rd.z;
    float tZout = (zc + th - ro.z) / rd.z;

    float tIn = -1.0e9;
    float tOut = 1.0e9;
    vec2 inN = vec2(0.0);
    bool empty = false;
    for (int k = 0; k < 3; k++) {
      vec2 Nk = k == 0 ? N0 : (k == 1 ? N1 : N2);
      float d = dot(rxy, Nk);
      float o = dot(oxy - center, Nk);
      if (abs(d) < 1.0e-6) {
        if (abs(o) > hwc) { empty = true; break; }
      } else {
        float ta = (-hwc - o) / d;
        float tb = (hwc - o) / d;
        float lo = min(ta, tb);
        float hi = max(ta, tb);
        if (lo > tIn) { tIn = lo; inN = -sign(d) * Nk; }
        tOut = min(tOut, hi);
      }
    }

    if (!empty) {
      float lo = max(tIn, tZin);
      float hi = min(tOut, tZout);
      if (lo <= hi && hi > 0.0) {
        tHit = max(lo, 0.0);
        onTop = tZin >= tIn;
        n = onTop ? vec3(0.0, 0.0, -1.0) : vec3(inN, 0.0);
        hit = true;
        break;
      }
    }

    float tExit = 1.0e9;
    vec2 step2 = vec2(0.0);
    for (int k = 0; k < 3; k++) {
      vec2 Nk = k == 0 ? N0 : (k == 1 ? N1 : N2);
      float d = dot(rxy, Nk);
      if (abs(d) < 1.0e-6) continue;
      float o = dot(oxy - center, Nk);
      float te = (0.5 * sign(d) - o) / d;
      if (te < tExit) { tExit = te; step2 = sign(d) * Nk; }
    }
    if (tExit >= tFloor || step2 == vec2(0.0)) break;
    center += step2;
  }

  vec3 Ld = normalize(vec3(-0.35, -0.5, -0.78));

  if (!hit) {
    vec2 fl = (oxy + rxy * tFloor);
    vec2 fLocal = fl;
    hextile(fLocal);
    float open = smoothstep(hw, hw + 0.22, hexDist(fLocal));
    if (uHasContent < 0.5) {
      return vec4(0.0, 0.0, 0.0, 0.4 - 0.25 * open);
    }
    return vec4(seam * mix(0.6, 1.0, open), 1.0);
  }

  vec3 p = ro + rd * tHit;

  float fc = smoothstep(0.18, 0.85, fCell);

  if (onTop) {
    vec2 lp = p.xy - center;
    float e = hwc - hexDist(lp);
    if (e < bevW) {
      float ax = abs(lp.x);
      float a1 = abs(dot(lp, N1));
      float a2 = abs(dot(lp, N2));
      vec2 dir = ax > a1 && ax > a2 ? N0 : (a1 > a2 ? N1 : N2);
      dir *= sign(dot(lp, dir));
      float k = (1.0 - smoothstep(0.0, max(bevW, 1.0e-4), e)) * (1.0 - fc);
      n = normalize(mix(vec3(0.0, 0.0, -1.0), vec3(dir * 0.85, -0.6), k));
    }
  }

  float diff = max(dot(n, Ld), 0.0);
  vec3 refl = reflect(rd, n);
  vec3 Ld2 = normalize(vec3(0.55, -0.25, -0.8));
  float glintL = pow(max(dot(refl, Ld), 0.0), 120.0);
  float sheenL = pow(max(dot(refl, Ld2), 0.0), 8.0) * 0.35;
  float spec = (glintL + sheenL) * uShine * (1.0 - fc);
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * (1.0 - fc);
  float iridPh = dot(n, -rd) * 2.2 + (p.x + p.y) * 0.22;
  vec3 iridTint = 1.0 + uIrid * 0.3 * cos(vec3(0.0, 2.094, 4.188) + iridPh * 3.5);
  vec3 specCol = spec * iridTint;
  float raised = clamp(-zc, -0.6, 1.4);

  if (uHasContent < 0.5) {
    float glint = spec * (0.4 + 0.6 * (onTop ? 0.4 : 1.0)) + fres * 0.2 * uShine;
    float shadeSide = onTop ? 0.0 : 0.3;
    float a = clamp(glint * 0.85 + shadeSide, 0.0, 0.85) * (1.0 - fc);
    return vec4(vec3(min(glint, a)), a);
  }

  if (onTop) {
    vec4 c = page(p.xy * cell - uScroll);
    vec3 face = mix(uBg, c.rgb, c.a);
    vec3 lit = face * (0.86 + 0.14 * diff + raised * 0.06)
      + specCol * 0.9 + fres * iridTint * 0.12 * uShine;
    return vec4(mix(lit, face, fc), 1.0);
  }

  float wallAo = 1.0 - smoothstep(zc - th, floorZ, p.z) * 0.4;
  vec3 wallCol = seam * mix(0.55, 1.0, diff) * wallAo
    + specCol * 1.3 + fres * iridTint * 0.28 * uShine;
  return vec4(wallCol, 1.0);
}

void main () {
  vec2 sUv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 px = 1.0 / uRes;
  vec4 a = shade(sUv + vec2( 0.125,  0.375) * px);
  vec4 b = shade(sUv + vec2(-0.125, -0.375) * px);
  vec4 c = a + b;
  if (dot(abs(a - b), vec4(1.0)) > 0.02) {
    c += shade(sUv + vec2(-0.375,  0.125) * px)
       + shade(sUv + vec2( 0.375, -0.125) * px);
    outColor = c * 0.25;
  } else {
    outColor = c * 0.5;
  }
}`,Ft=`#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
uniform vec2 texelSize;
void main () {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`,It=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec3 uColor;
uniform vec2 uPoint;
uniform float uRadius;
void main () {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
  vec3 base = texture(uTarget, vUv).xyz;
  outColor = vec4(base + splat, 1.0);
}`,Bt=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float uDt;
uniform float uDissipation;
void main () {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * texelSize;
  outColor = uDissipation * texture(uSource, coord);
  outColor.a = 1.0;
}`,Nt=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
uniform float uValue;
void main () {
  outColor = uValue * texture(uTexture, vUv);
}`,Gt=`#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
void main () {
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) { L = -C.x; }
  if (vR.x > 1.0) { R = -C.x; }
  if (vT.y > 1.0) { T = -C.y; }
  if (vB.y < 0.0) { B = -C.y; }
  float div = 0.5 * (R - L + T - B);
  outColor = vec4(div, 0.0, 0.0, 1.0);
}`,Xt=`#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
void main () {
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  float vorticity = R - L - T + B;
  outColor = vec4(vorticity, 0.0, 0.0, 1.0);
}`,zt=`#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlStrength;
uniform float uDt;
void main () {
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = vec2(abs(T) - abs(B), abs(R) - abs(L)) * 0.5;
  force /= length(force) + 1.0;
  force *= uCurlStrength * C;
  force.y *= -1.0;
  vec2 velocity = texture(uVelocity, vUv).xy;
  outColor = vec4(velocity + force * uDt, 0.0, 1.0);
}`,Ht=`#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main () {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  float pressure = (L + R + B + T - divergence) * 0.25;
  outColor = vec4(pressure, 0.0, 0.0, 1.0);
}`,Ot=`#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main () {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity.xy -= vec2(R - L, T - B);
  outColor = vec4(velocity, 0.0, 1.0);
}`,Vt=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
void main () {
  vec3 c = texture(uScene, vUv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  outColor = vec4(c * smoothstep(0.55, 0.95, l), 1.0);
}`,kt=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform vec2 uDir;
void main () {
  vec3 c = texture(uScene, vUv).rgb * 0.227027;
  c += texture(uScene, vUv + uDir * 1.3846154).rgb * 0.3162162;
  c += texture(uScene, vUv - uDir * 1.3846154).rgb * 0.3162162;
  c += texture(uScene, vUv + uDir * 3.2307692).rgb * 0.0702703;
  c += texture(uScene, vUv - uDir * 3.2307692).rgb * 0.0702703;
  outColor = vec4(c, 1.0);
}`,Wt=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform sampler2D uBloomTex;
uniform float uBloomAmt;
uniform float uGrainAmt;
uniform float uTime;
void main () {
  vec4 scene = texture(uScene, vUv);
  vec3 bloom = texture(uBloomTex, vUv).rgb * uBloomAmt;
  vec3 col = scene.rgb + bloom;
  float g = fract(sin(dot(gl_FragCoord.xy + vec2(uTime * 61.7, uTime * 123.4),
    vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  col += g * uGrainAmt * 0.14;
  float ba = dot(bloom, vec3(0.333));
  outColor = vec4(col, clamp(scene.a + ba, 0.0, 1.0));
}`,W=96,Yt=256,ft=1/60,Zt=.985,qt=.8,Kt=4;function Jt(){if(typeof document>"u")return!1;let P=document.createElement("canvas"),L=P.getContext("2d");return!!(L&&typeof L.drawElementImage=="function"&&typeof P.requestPaint=="function")}var De="data-canvasui-hover",G="data-canvasui-content",$t=`:is([${De}], :hover:where(:not([${G}], [${G}] *)))`;function Qt(){if(typeof document>"u"||document.documentElement.dataset.canvasuiHoverRules==="")return;document.documentElement.dataset.canvasuiHoverRules="";let P=a=>{for(let m of Array.from(a))if(m instanceof CSSStyleRule){if(m.selectorText.includes(":hover"))try{m.selectorText=m.selectorText.replace(/:hover\b/g,$t)}catch{}m.cssRules.length&&P(m.cssRules)}else if("cssRules"in m)try{P(m.cssRules)}catch{}};for(let a of Array.from(document.styleSheets))try{P(a.cssRules)}catch{}let L=document.createElement("style");L.textContent=`[${G}], [${G}] * { cursor: var(--canvasui-cursor, auto) !important; }`,document.head.appendChild(L)}function eo(P,L={}){let a={...Dt,...L},{source:m,content:u,output:c}=P,e=c.getContext("webgl2",{alpha:!0,depth:!1,stencil:!1,antialias:!1,premultipliedAlpha:!0});if(!e||e.isContextLost())return null;let Y=m.getContext("2d"),Z=m,E=!!(Y&&typeof Y.drawElementImage=="function"&&typeof Z.requestPaint=="function"),q=!1,_e=()=>{};E&&(Z.onpaint=()=>{try{Y.reset(),Y.drawElementImage(u,0,0),q=!0,_e()}catch{}});function le(t,o){let r=e.createShader(t);return e.shaderSource(r,o),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)||console.error("HexFloat shader error:",e.getShaderInfoLog(r)),r}let se=le(e.VERTEX_SHADER,_t),Me=le(e.FRAGMENT_SHADER,Mt),C=e.createProgram();e.attachShader(C,se),e.attachShader(C,Me),e.linkProgram(C);let f={},mt=e.getProgramParameter(C,e.ACTIVE_UNIFORMS);for(let t=0;t<mt;t++){let o=e.getActiveUniform(C,t);f[o.name.replace("[0]","")]=e.getUniformLocation(C,o.name)}let Fe=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,Fe),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.getExtension("EXT_color_buffer_float");let Ie=!!e.getExtension("OES_texture_float_linear")?e.LINEAR:e.NEAREST,Be=[],fe=[];function me(t,o){let r=le(t,o);return Be.push(r),r}let vt=me(e.VERTEX_SHADER,Ft);function w(t){let o=e.createProgram();e.attachShader(o,vt),e.attachShader(o,me(e.FRAGMENT_SHADER,t)),e.linkProgram(o),fe.push(o);let r={},n=e.getProgramParameter(o,e.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){let l=e.getActiveUniform(o,i);r[l.name]=e.getUniformLocation(o,l.name)}return{program:o,uniforms:r}}let A=w(It),b=w(Bt),ve=w(Nt),de=w(Gt),pe=w(Xt),F=w(zt),K=w(Ht),$=w(Ot);function Q(t,o,r,n){let i=e.createTexture();e.bindTexture(e.TEXTURE_2D,i),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,n),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,n),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,o,t,t,0,r,e.HALF_FLOAT,null);let l=e.createFramebuffer();return e.bindFramebuffer(e.FRAMEBUFFER,l),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,i,0),e.viewport(0,0,t,t),e.clearColor(0,0,0,1),e.clear(e.COLOR_BUFFER_BIT),{fbo:l,texture:i,width:t,height:t}}function xe(t,o,r,n){let i=Q(t,o,r,n),l=Q(t,o,r,n);return{get read(){return i},get write(){return l},swap(){let x=i;i=l,l=x}}}let v=xe(W,e.RG16F,e.RG,Ie),R=xe(Yt,e.R16F,e.RED,Ie),he=Q(W,e.R16F,e.RED,e.NEAREST),Te=Q(W,e.R16F,e.RED,e.NEAREST),y=xe(W,e.R16F,e.RED,e.NEAREST),p=1/W;function dt(){[v.read,v.write,R.read,R.write,y.read,y.write,he,Te].forEach(t=>{e.deleteFramebuffer(t.fbo),e.deleteTexture(t.texture)}),fe.forEach(t=>e.deleteProgram(t)),Be.forEach(t=>e.deleteShader(t))}function d(t){e.bindFramebuffer(e.FRAMEBUFFER,t.fbo),e.viewport(0,0,t.width,t.height),e.drawArrays(e.TRIANGLE_STRIP,0,4)}function s(t,o){return e.activeTexture(e.TEXTURE0+o),e.bindTexture(e.TEXTURE_2D,t),o}function pt(t,o,r,n,i){let l=c.clientWidth/Math.max(c.clientHeight,1),x=Math.max(a.radius,40)/Math.max(c.clientHeight,1),k=x*x*.28;e.useProgram(A.program),e.uniform1f(A.uniforms.uAspect,l),e.uniform2f(A.uniforms.uPoint,t,o),e.uniform1f(A.uniforms.uRadius,k),e.uniform1i(A.uniforms.uTarget,s(v.read.texture,0)),e.uniform3f(A.uniforms.uColor,r,n,0),d(v.write),v.swap(),e.uniform1i(A.uniforms.uTarget,s(R.read.texture,0)),e.uniform3f(A.uniforms.uColor,i,0,0),d(R.write),R.swap()}function xt(t){e.disable(e.BLEND),e.useProgram(pe.program),e.uniform2f(pe.uniforms.texelSize,p,p),e.uniform1i(pe.uniforms.uVelocity,s(v.read.texture,0)),d(Te),e.useProgram(F.program),e.uniform2f(F.uniforms.texelSize,p,p),e.uniform1i(F.uniforms.uVelocity,s(v.read.texture,0)),e.uniform1i(F.uniforms.uCurl,s(Te.texture,1)),e.uniform1f(F.uniforms.uCurlStrength,Math.max(a.swirl,0)),e.uniform1f(F.uniforms.uDt,ft),d(v.write),v.swap(),e.useProgram(de.program),e.uniform2f(de.uniforms.texelSize,p,p),e.uniform1i(de.uniforms.uVelocity,s(v.read.texture,0)),d(he),e.useProgram(ve.program),e.uniform1i(ve.uniforms.uTexture,s(y.read.texture,0)),e.uniform1f(ve.uniforms.uValue,Math.pow(qt,t*60)),d(y.write),y.swap(),e.useProgram(K.program),e.uniform2f(K.uniforms.texelSize,p,p),e.uniform1i(K.uniforms.uDivergence,s(he.texture,0));for(let r=0;r<Kt;r++)e.uniform1i(K.uniforms.uPressure,s(y.read.texture,1)),d(y.write),y.swap();e.useProgram($.program),e.uniform2f($.uniforms.texelSize,p,p),e.uniform1i($.uniforms.uPressure,s(y.read.texture,0)),e.uniform1i($.uniforms.uVelocity,s(v.read.texture,1)),d(v.write),v.swap(),e.useProgram(b.program),e.uniform2f(b.uniforms.texelSize,p,p),e.uniform1i(b.uniforms.uVelocity,s(v.read.texture,0)),e.uniform1i(b.uniforms.uSource,s(v.read.texture,0)),e.uniform1f(b.uniforms.uDt,ft),e.uniform1f(b.uniforms.uDissipation,Math.pow(Zt,t*60)),d(v.write),v.swap(),e.uniform1i(b.uniforms.uVelocity,s(v.read.texture,0)),e.uniform1i(b.uniforms.uSource,s(R.read.texture,1));let o=.9+Math.min(Math.max(a.trail,0),1)*.08;e.uniform1f(b.uniforms.uDissipation,Math.pow(o,t*60)),d(R.write),R.swap()}function ge(t){let o=e.createProgram();e.attachShader(o,se),e.attachShader(o,me(e.FRAGMENT_SHADER,t)),e.linkProgram(o),fe.push(o);let r={},n=e.getProgramParameter(o,e.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){let l=e.getActiveUniform(o,i);r[l.name]=e.getUniformLocation(o,l.name)}return{program:o,uniforms:r}}let Ne=ge(Vt),X=ge(kt),I=ge(Wt),g=null,S=null,z=null;function Ee(t,o){let r=e.createTexture();e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t,o,0,e.RGBA,e.UNSIGNED_BYTE,null);let n=e.createFramebuffer();return e.bindFramebuffer(e.FRAMEBUFFER,n),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,r,0),{fbo:n,texture:r,width:t,height:o}}function Ge(){[g,S,z].forEach(t=>{t&&(e.deleteFramebuffer(t.fbo),e.deleteTexture(t.texture))}),g=null,S=null,z=null}function ht(){let t=c.width,o=c.height;if(g&&g.width===t&&g.height===o)return;Ge(),g=Ee(t,o);let r=Math.max(1,t>>2),n=Math.max(1,o>>2);S=Ee(r,n),z=Ee(r,n)}let j=e.createTexture();e.bindTexture(e.TEXTURE_2D,j),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));let Xe=1,h=[1,1,1],be=document.createElement("canvas");be.width=be.height=1;let H=be.getContext("2d",{willReadFrequently:!0});function ze(){if(!H)return;let t=u;for(;t;){let o=getComputedStyle(t).backgroundColor;if(o&&o!=="transparent"){H.clearRect(0,0,1,1),H.fillStyle=o,H.fillRect(0,0,1,1);let[r,n,i,l]=H.getImageData(0,0,1,1).data;if(l>0){h=[r/255,n/255,i/255];return}}t=t.parentElement}h=[1,1,1]}function Re(){let t=Math.min(window.devicePixelRatio||1,2),o=Math.max(1,Math.round(c.clientWidth*t)),r=Math.max(1,Math.round(c.clientHeight*t));if((c.width!==o||c.height!==r)&&(c.width=o,c.height=r),Xe=Math.min(1,Math.max(.05,u.clientWidth/Math.max(c.clientWidth,1))),E){let n=Math.max(1,Math.round(m.clientWidth)),i=Math.max(1,Math.round(m.clientHeight));(m.width!==n*t||m.height!==i*t)&&(m.width=n*t,m.height=i*t),Z.requestPaint()}}ze(),Re();function Tt(){!E||!q||(q=!1,e.bindTexture(e.TEXTURE_2D,j),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,m))}let ye=0,D=!1,Se=0,Pe=0,He=0,Oe=0,O=!1,V=0;function gt(){if(a.gapColor!=="auto")return a.gapColor;let o=.2126*h[0]+.7152*h[1]+.0722*h[2]>.5?.55:.35;return[h[0]*o,h[1]*o,h[2]*o]}function Et(){Tt();let t=c.width/Math.max(c.clientWidth,1),o=gt();e.useProgram(C),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,j),e.uniform1i(f.uContent,0),e.uniform2f(f.uRes,c.width,c.height),e.uniform1f(f.uSize,Math.max(a.size,8)*t),e.uniform1f(f.uGap,Math.max(a.gap,0)*t),e.uniform1f(f.uBevel,Math.max(a.bevel,0)*t),e.uniform1f(f.uTilt,Math.min(Math.max(a.tilt,-30),30)*Math.PI/180),e.uniform1f(f.uDist,2.6-Math.min(Math.max(a.perspective,0),1)*2.2),e.uniform1f(f.uFloat,Math.max(a.float,0)),e.uniform1f(f.uShine,Math.max(a.shine,0)),e.uniform1f(f.uLift,Math.max(a.lift,0)),e.uniform1f(f.uIrid,Math.max(a.iridescence,0)),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,R.read.texture),e.uniform1i(f.uFlow,1),e.uniform2f(f.uScroll,u.scrollLeft*t,u.scrollTop*t),e.uniform1f(f.uTime,ye),e.uniform1f(f.uHasContent,E?1:0),e.uniform1f(f.uMaxX,Xe),e.uniform3f(f.uBg,h[0],h[1],h[2]),e.uniform3f(f.uGapColor,o[0],o[1],o[2]);let r=a.bloom>.001;if(!(r||a.grain>.001)){e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,c.width,c.height),e.drawArrays(e.TRIANGLE_STRIP,0,4);return}ht(),d(g),r&&(e.useProgram(Ne.program),e.uniform1i(Ne.uniforms.uScene,s(g.texture,0)),d(S),e.useProgram(X.program),e.uniform1i(X.uniforms.uScene,s(S.texture,0)),e.uniform2f(X.uniforms.uDir,1/S.width,0),d(z),e.uniform1i(X.uniforms.uScene,s(z.texture,0)),e.uniform2f(X.uniforms.uDir,0,1/S.height),d(S)),e.useProgram(I.program),e.uniform1i(I.uniforms.uScene,s(g.texture,0)),e.uniform1i(I.uniforms.uBloomTex,s((S??g).texture,1)),e.uniform1f(I.uniforms.uBloomAmt,r?Math.min(Math.max(a.bloom,0),1)*1.4:0),e.uniform1f(I.uniforms.uGrainAmt,Math.min(Math.max(a.grain,0),1)),e.uniform1f(I.uniforms.uTime,ye),e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,c.width,c.height),e.drawArrays(e.TRIANGLE_STRIP,0,4)}let Ce=0,we=performance.now(),Ae=!1,J=!1,ee=!0,te=window.matchMedia("(prefers-reduced-motion: reduce)"),oe=te.matches;function bt(){return oe?!1:!!(a.float>0||a.grain>.001||D||performance.now()<V)}function Ve(t){if(Ae)return;if(!ee){J=!1;return}let o=Math.min(Math.max((t-we)/1e3,0),1/30);if(we=t,!oe){if(ye+=o*Math.max(a.speed,0),D){let r=re(Se,Pe);if(r){let n=Math.max(c.clientWidth,1),i=Math.max(c.clientHeight,1),l=r.x/n,x=r.y/i,k=O?(l-He)*n:0,Le=O?(x-Oe)*i:0,ue=1.6*Math.max(a.flow,0);pt(l,x,k*ue,Le*ue,10*o),He=l,Oe=x,O=!0,V=t+4e3}}(t<V||D)&&xt(o)}if(Et(),!bt()&&!q){J=!1;return}Ce=requestAnimationFrame(Ve)}function T(){Ae||J||!ee||(J=!0,we=performance.now(),Ce=requestAnimationFrame(Ve))}_e=T,T();function ke(t){Se=t.clientX,Pe=t.clientY,D=!0,V=performance.now()+4e3,Ke(t.clientX,t.clientY),T()}function We(){D=!1,O=!1,ie(null),T()}u.addEventListener("pointermove",ke,{passive:!0}),u.addEventListener("pointerleave",We,{passive:!0});function Ye(){D&&Ke(Se,Pe),T()}u.addEventListener("scroll",Ye,{passive:!0});function re(t,o){let r=c.getBoundingClientRect(),n=c.width/Math.max(c.clientWidth,1),i=c.width,l=c.height;if(i<1||l<1)return null;let x=(t-r.left)*n,k=(o-r.top)*n,Le=i/l,ue=(x/i*2-1)*Le,it=k/l*2-1,at=Math.min(Math.max(a.tilt,-30),30)*Math.PI/180,U=Math.sin(at),_=Math.cos(at),B=Math.max(a.size,8)*n,N=l/B,Rt=2.6-Math.min(Math.max(a.perspective,0),1)*2.2,M=N*Rt,ce=(M+Math.sqrt(M*M+N*N*U*U))/(N*_),yt=.5*N-U*M-_*M*(_-ce*U)/(U+ce*_),ut=u.scrollLeft*n,ct=u.scrollTop*n,St=ut/B+.5*i/B,Pt=ct/B+.5*N+yt+U*M,Ct=-_*M,wt=ue,At=it*_-ce*U,lt=it*U+ce*_;if(lt<1e-6)return null;let st=-Ct/lt,Ut=(St+wt*st)*B-ut,Lt=(Pt+At*st)*B-ct;return{x:Ut/n,y:Lt/n}}let ne=!1,Ze=[],qe=null;E&&(Qt(),u.setAttribute(G,""));function ie(t){if(t===qe)return;qe=t;let o=new Set;for(let r=t;r&&(o.add(r),r!==u);r=r.parentElement);for(let r of Ze)o.has(r)||r.removeAttribute(De);for(let r of o)r.setAttribute(De,"");Ze=Array.from(o),t?u.style.setProperty("--canvasui-cursor",getComputedStyle(t).cursor):u.style.removeProperty("--canvasui-cursor")}function Ke(t,o){if(!E)return;let r=re(t,o);if(!r){ie(null);return}let n=u.getBoundingClientRect(),i=document.elementFromPoint(n.left+r.x,n.top+r.y);ie(i&&u.contains(i)?i:null)}function $e(t){if(ne||!E)return;let o=re(t.clientX,t.clientY);if(!o)return;let r=u.getBoundingClientRect(),n=r.left+o.x,i=r.top+o.y;if(Math.hypot(n-t.clientX,i-t.clientY)<1.5)return;t.preventDefault(),t.stopPropagation();let l=document.elementFromPoint(n,i);if(!l||!u.contains(l))return;let x=l.closest("a, button, input, select, textarea, [tabindex]");ne=!0;try{x?.focus?.(),l.dispatchEvent(new MouseEvent("click",{bubbles:!0,cancelable:!0,view:window,clientX:n,clientY:i,button:t.button,ctrlKey:t.ctrlKey,shiftKey:t.shiftKey,altKey:t.altKey,metaKey:t.metaKey}))}finally{ne=!1}}u.addEventListener("click",$e,!0);function Qe(t,o){let r=document;if(typeof r.caretPositionFromPoint=="function"){let i=r.caretPositionFromPoint(t,o);return i?{node:i.offsetNode,offset:i.offset}:null}let n=r.caretRangeFromPoint?.(t,o);return n?{node:n.startContainer,offset:n.startOffset}:null}function je(t){let o=re(t.clientX,t.clientY);if(!o)return null;let r=u.getBoundingClientRect(),n=r.left+o.x,i=r.top+o.y;return Math.hypot(n-t.clientX,i-t.clientY)<1.5?null:{x:n,y:i}}let ae=!1;function Je(t){if(ne||!E||t.button!==0)return;let o=je(t);if(!o)return;t.preventDefault();let r=Qe(o.x,o.y);if(!r||!u.contains(r.node))return;let n=window.getSelection();n&&(n.removeAllRanges(),n.collapse(r.node,r.offset),ae=!0)}function et(t){if(!ae)return;if(!(t.buttons&1)){ae=!1;return}let o=je(t),r=o?Qe(o.x,o.y):null,n=window.getSelection();r&&n&&n.anchorNode&&u.contains(r.node)&&n.extend(r.node,r.offset)}function tt(){ae=!1}u.addEventListener("mousedown",Je,!0),window.addEventListener("mousemove",et,!0),window.addEventListener("mouseup",tt,!0);function ot(){oe=te.matches,oe&&(D=!1,O=!1,V=0),T()}te.addEventListener("change",ot);let Ue=new ResizeObserver(()=>{Re(),T()});Ue.observe(c),Ue.observe(u);let rt=new IntersectionObserver(t=>{ee=t[t.length-1]?.isIntersecting??!0,ee&&T()});rt.observe(c);let nt=new MutationObserver(()=>{ze(),T()});return nt.observe(document.documentElement,{attributes:!0,attributeFilter:["class","style","data-theme"]}),{setOptions(t){Object.assign(a,t),T()},resize(){Re(),T()},destroy(){Ae=!0,cancelAnimationFrame(Ce),ie(null),u.removeAttribute(G),u.removeEventListener("pointermove",ke),u.removeEventListener("pointerleave",We),u.removeEventListener("scroll",Ye),u.removeEventListener("click",$e,!0),u.removeEventListener("mousedown",Je,!0),window.removeEventListener("mousemove",et,!0),window.removeEventListener("mouseup",tt,!0),Ue.disconnect(),rt.disconnect(),nt.disconnect(),te.removeEventListener("change",ot),e.deleteTexture(j),dt(),Ge(),e.deleteProgram(C),e.deleteShader(se),e.deleteShader(Me),e.deleteBuffer(Fe),E&&(Z.onpaint=null)}}}export{eo as createHexFloat,Jt as supportsHtmlInCanvas};
