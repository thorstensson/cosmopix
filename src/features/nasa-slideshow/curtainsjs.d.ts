declare module 'curtainsjs' {
  export class Curtains {
    constructor(options: {
      container: string
      watchScroll?: boolean
      pixelRatio?: number
      premultipliedAlpha?: boolean
      alpha?: boolean
      transparent?: boolean
    })

    gl: WebGLRenderingContext

    onError(callback: () => void): this
    onContextLost(callback: () => void): this
    disableDrawing(): void
    enableDrawing(): void
    restoreContext(): void
    dispose(): void
  }

  // Define a simple Texture interface to replace 'any'
  export interface Texture {
    sampler: string
    setSource(source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement): void
    setMinFilter(filter: number): void
    [key: string]: unknown
  }

  export class Plane {
    constructor(
      curtains: Curtains,
      element: Element,
      params: {
        vertexShader: string
        fragmentShader: string
        uniforms: Record<
          string,
          { name: string; type: string; value: number | number[] | Float32Array }
        >
        widthSegments?: number
        heightSegments?: number
      }
    )

    textures: Texture[]
    images: HTMLImageElement[]
    uniforms: Record<string, { value: unknown }>

    onLoading(callback: (texture: Texture) => void): this
    onReady(callback: () => void): this
    onRender(callback: () => void): this

    createTexture(options: { sampler: string; fromTexture: Texture }): Texture
  }
}
