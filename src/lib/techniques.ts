export interface Technique {
  name: string;
  category: string;
  risk: "Critical" | "High" | "Medium" | "Low";
  desc: string;
  map?: Record<string, string>;
  encode: (input: string, map?: Record<string, string>) => string;
  decode: (input: string, map?: Record<string, string>) => string;
}

export const TECHNIQUES: Record<string, Technique> = {
  unicode_confusables: {
    name: "Unicode Confusables",
    category: "Visual",
    risk: "High",
    desc: "Substitutes ASCII characters with visually identical Unicode codepoints from Cyrillic, Greek, and other scripts. Bypasses string-matching filters while appearing unchanged to human reviewers.",
    map: {
      a: "\u0430", e: "\u0435", o: "\u043E", p: "\u0440", c: "\u0441",
      x: "\u0445", s: "\u0455", i: "\u0456", j: "\u0458", y: "\u0443",
      A: "\u0410", B: "\u0412", C: "\u0421", E: "\u0415", H: "\u041D",
      K: "\u041A", M: "\u041C", O: "\u041E", P: "\u0420", T: "\u0422",
      X: "\u0425", S: "\u0405",
    },
    encode: (input, map) => input.split("").map(c => map?.[c] || c).join(""),
    decode: (input, map) => {
      const rev: Record<string, string> = {};
      if (map) Object.entries(map).forEach(([k, v]) => (rev[v] = k));
      return input.split("").map(c => rev[c] || c).join("");
    },
  },
  zero_width: {
    name: "Zero-Width Encoding",
    category: "Steganographic",
    risk: "Critical",
    desc: "Encodes each character as a binary sequence of zero-width Unicode characters (U+200B, U+200C, U+200D). Payload is completely invisible in rendered text.",
    encode: (input) => {
      return input
        .split("")
        .map((c) => {
          const bin = c.charCodeAt(0).toString(2).padStart(8, "0");
          return (
            bin
              .split("")
              .map((b) => (b === "1" ? "\u200B" : "\u200C"))
              .join("") + "\u200D"
          );
        })
        .join("");
    },
    decode: (input) => {
      const chunks = input.split("\u200D").filter(Boolean);
      return chunks
        .map((chunk) => {
          const bin = chunk
            .split("")
            .map((c) => (c === "\u200B" ? "1" : "0"))
            .join("");
          return String.fromCharCode(parseInt(bin, 2));
        })
        .join("");
    },
  },
  hex_encode: {
    name: "Hex Escape Encoding",
    category: "Obfuscation",
    risk: "Medium",
    desc: "Converts each character to its hexadecimal escape sequence (\\xNN). Common in polyglot payloads and filter evasion contexts.",
    encode: (input) =>
      input
        .split("")
        .map((c) => "\\x" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    decode: (input) =>
      input.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) =>
        String.fromCharCode(parseInt(h, 16)),
      ),
  },
  base64_chunks: {
    name: "Chunked Base64",
    category: "Obfuscation",
    risk: "Medium",
    desc: "Splits base64-encoded payload into indexed chunks with hex-addressed segments. Evades pattern detection on contiguous base64 strings.",
    encode: (input) => {
      const b64 = btoa(input);
      const chunks = b64.match(/.{1,4}/g) || [];
      return chunks
        .map((c, i) => `[${i.toString(16).padStart(2, "0")}]${c}`)
        .join("|");
    },
    decode: (input) => {
      const chunks = input.split("|").map((s) => s.replace(/\[[0-9a-f]+\]/g, ""));
      try {
        return atob(chunks.join(""));
      } catch {
        return "[DECODE ERROR]";
      }
    },
  },
  reverse_rtl: {
    name: "RTL Override",
    category: "Directional",
    risk: "High",
    desc: "Injects Unicode right-to-left override (U+202E) to visually reverse text rendering direction. Used in filename spoofing and phishing attacks.",
    encode: (input) => "\u202E" + input + "\u202C",
    decode: (input) => input.replace(/[\u202E\u202C]/g, ""),
  },
  tag_smuggle: {
    name: "HTML Comment Injection",
    category: "Structural",
    risk: "Medium",
    desc: "Embeds hex-encoded payload inside an HTML comment with a data-ref attribute pattern. Survives most sanitization that preserves comments.",
    encode: (input) => {
      const hex = input
        .split("")
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("");
      return `<!-- data-ref="${hex}" -->`;
    },
    decode: (input) => {
      const match = input.match(/data-ref="([0-9a-f]+)"/);
      if (!match) return "[NO PAYLOAD]";
      const hex = match[1];
      let out = "";
      for (let i = 0; i < hex.length; i += 2)
        out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      return out;
    },
  },
  case_toggle: {
    name: "Case-Bit Steganography",
    category: "Steganographic",
    risk: "Low",
    desc: "Encodes binary data in the case pattern of alphabetical carrier text. Each uppercase letter represents a 1 bit, lowercase represents 0.",
    encode: (input) => {
      const bits = input
        .split("")
        .map((c) => c.charCodeAt(0).toString(2).padStart(8, "0"))
        .join("");
      const carrier = "abcdefghijklmnopqrstuvwxyz".repeat(
        Math.ceil(bits.length / 26),
      );
      return bits
        .split("")
        .map((b, i) => (b === "1" ? carrier[i].toUpperCase() : carrier[i]))
        .join("");
    },
    decode: (input) => {
      const bits = input
        .split("")
        .map((c) => (c === c.toUpperCase() ? "1" : "0"))
        .join("");
      let out = "";
      for (let i = 0; i + 8 <= bits.length; i += 8)
        out += String.fromCharCode(parseInt(bits.substr(i, 8), 2));
      return out;
    },
  },
  homoglyph_chain: {
    name: "Multi-Script Homoglyphs",
    category: "Visual",
    risk: "High",
    desc: "Substitutes characters using lookalikes from Greek, Cyrillic, Armenian, and other Unicode blocks. Broader coverage than single-script confusables.",
    encode: (input) => {
      const m: Record<string, string> = {
        a: "\u03B1", b: "\u0432", d: "\u0501", e: "\u03B5", g: "\u0261",
        h: "\u04BB", i: "\u0456", k: "\u03BA", n: "\u0578", o: "\u03BF",
        p: "\u0440", r: "\u0433", s: "\u0455", u: "\u057D", v: "\u0475",
        w: "\u0461", x: "\u0445", y: "\u0443", z: "\u0502",
      };
      return input
        .split("")
        .map((c) => m[c.toLowerCase()] || c)
        .join("");
    },
    decode: (input) => {
      const rev: Record<string, string> = {
        "\u03B1": "a", "\u0432": "b", "\u0501": "d", "\u03B5": "e", "\u0261": "g",
        "\u04BB": "h", "\u0456": "i", "\u03BA": "k", "\u0578": "n", "\u03BF": "o",
        "\u0440": "p", "\u0433": "r", "\u0455": "s", "\u057D": "u", "\u0475": "v",
        "\u0461": "w", "\u0445": "x", "\u0443": "y", "\u0502": "z",
      };
      return input
        .split("")
        .map((c) => rev[c] || c)
        .join("");
    },
  },
};

export const RISK_COLORS: Record<string, string> = {
  Critical: "text-red-700",
  High: "text-amber-700",
  Medium: "text-yellow-800",
  Low: "text-green-800",
};

export const RISK_BG: Record<string, string> = {
  Critical: "bg-red-50 border-red-200",
  High: "bg-amber-50 border-amber-200",
  Medium: "bg-yellow-50 border-yellow-200",
  Low: "bg-green-50 border-green-200",
};

export const CAT_LABELS: Record<string, string> = {
  Visual: "VIS",
  Steganographic: "STG",
  Obfuscation: "OBF",
  Directional: "DIR",
  Structural: "STR",
};
