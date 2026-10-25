// Stub used by the single-file build: no GLB replacements ship with it, and the real
// loader embeds AVIF/WebP probe images that some sharing reviewers reject.
export class GLTFLoader {
  loadAsync() {
    return Promise.reject(new Error('GLTF loading is disabled in the single-file build'));
  }
}
