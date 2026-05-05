/// <reference types="vite/client" />

declare module '*.png' {
  const src: string
  export default src
}

declare module 'html2pdf.js' {
  interface Html2PdfChain {
    set(options: Record<string, unknown>): Html2PdfChain
    from(source: HTMLElement | string): Html2PdfChain
    save(): Promise<unknown>
  }
  function html2pdf(): Html2PdfChain
  export default html2pdf
}

