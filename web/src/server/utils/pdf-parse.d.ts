// pdf-parse v1's index.js runs a debug self-test when bundled, so cvParser.ts
// imports the library entry directly. Reuse @types/pdf-parse for that path.
declare module 'pdf-parse/lib/pdf-parse.js' {
  import PdfParse = require('pdf-parse');
  export = PdfParse;
}
