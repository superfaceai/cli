import { OutputStream } from './output-stream';

export class ListWriter {
  private firstOutput: boolean;

  constructor(
    private outputStream: OutputStream,
    /** Glue to prepend to every entry but the first (unless `startWithGlue` is specified) */
    private outputGlue: string,
    /** If set, the first output will have glue prepended. */
    private startWithGlue?: boolean
  ) {
    this.firstOutput = false;
  }

  async writeElement(element: string): Promise<void> {
    if (this.firstOutput || this.startWithGlue === true) {
      element = this.outputGlue + element;
    }
    this.firstOutput = true;

    return this.outputStream.write(element);
  }
}
