import { index_of } from "./fluid-common.wgsl";

struct DisplayConfig {
  output_size: vec2f,
  theme_mode: f32,
  _pad: f32,
}
const DYE_SIZE = vec2u(512, 288);
@group(0) @binding(0) var<uniform> config: DisplayConfig;
@group(0) @binding(1) var<storage, read> dye: array<vec4f>;

fn sample_dye(p: vec2f) -> vec3f {
  let grid = clamp(p * vec2f(DYE_SIZE) - 0.5, vec2f(0), vec2f(DYE_SIZE) - 1.0);
  let cell = vec2i(floor(grid));
  let f = fract(grid);
  let bottom = mix(dye[index_of(cell, DYE_SIZE)].rgb, dye[index_of(cell + vec2i(1, 0), DYE_SIZE)].rgb, f.x);
  let top = mix(dye[index_of(cell + vec2i(0, 1), DYE_SIZE)].rgb, dye[index_of(cell + vec2i(1, 1), DYE_SIZE)].rgb, f.x);
  return mix(bottom, top, f.y);
}

@fragment
fn fragment_main(@builtin(position) position: vec4f) -> @location(0) vec4f {
  var uv = position.xy / config.output_size;
  uv.y = 1.0 - uv.y; // WebGPU fragment coordinates start at the top; the solver's +Y points up.
  let density = sample_dye(uv);
  let color = 1.0 - exp(-density * 1.35);
  let vignette = 0.68 + 0.32 * pow(max(0.0, 1.0 - dot(uv - 0.5, uv - 0.5) * 1.9), 1.5);

  // Dark Mode: exact canonical vgpu source colors on dark base with vignette
  let dark_base = vec3f(0.003, 0.005, 0.014);
  let dark_fluid = (dark_base + color) * vignette;

  // Light Mode: clean paper-white background with vibrant source dye hues
  let light_base = vec3f(0.985, 0.985, 0.990);
  let ink_strength = clamp(1.0 - exp(-length(density) * 1.4), 0.0, 0.88);
  let ink_hue = color / (max(color.r, max(color.g, color.b)) + 0.001);
  let rich_ink = ink_hue * vec3f(0.85, 0.82, 0.90);
  let light_fluid = mix(light_base, rich_ink, ink_strength);

  let final_rgb = mix(dark_fluid, light_fluid, config.theme_mode);
  return vec4f(final_rgb, 1.0);
}
