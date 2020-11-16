export function formatWordPlurality(num: number, word: string): string {
    if (num === 1) {
      return `${num} ${word}`
    } else {
      return `${num} ${word}s`
    }
  }