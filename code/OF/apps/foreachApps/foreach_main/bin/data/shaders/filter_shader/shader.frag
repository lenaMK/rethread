#version 330
precision highp float;


uniform sampler2DRect tex0;
uniform vec2 mouse;
uniform vec2 resolution;
uniform vec2 outputResolution;
uniform float zoom;
uniform float gain;
uniform float exponent;
uniform float invertY;
uniform float pixelsProcessed;

in vec2 texCoordVarying;


out vec4 outputColor;

float sum(vec3 c) {
    return c.x+c.y+c.z;
}

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

float luma(vec4 color) {
  return dot(color.rgb, vec3(0.299, 0.587, 0.114));
}


void main()
{
	vec2 st = ((gl_FragCoord.xy/outputResolution)-0.5);
  st.y += st.y * -2.0 * invertY;
  st *= outputResolution;
  float zoom2 = outputResolution.y/resolution.y;
  vec2 imageSize = resolution * zoom2;
  st += imageSize * 0.5;
  st /= zoom2;
	vec2 texCoord = st;
  float pixelIndex = st.x + resolution.x*st.y;
  vec3 org_color = texture(tex0, texCoord).rgb;

  float luma = luma(org_color);
  vec3 c0 = vec3(1.0, 0.2, 0.7) * 1.3;
  vec3 c1 = vec3(0.1, 0.7, 1.2) * 1.5;

  vec3 color = mix(c1, c0, smoothstep(0.2, 0.8, pow(luma + gain, exponent))) * (pow(luma + 0.1, 2.0) + 0.1);

  // float alpha = float(pixelIndex <= pixelsProcessed);
  float alpha = 1.0;
  color = mix(org_color, color, float(pixelIndex <= pixelsProcessed));

  outputColor = vec4(color, alpha);
}
