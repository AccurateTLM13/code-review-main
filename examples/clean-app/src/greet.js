// Clean fixture: straightforward, small, no planted issues.
import { add } from './calc.js';

export function greetingFor(name) {
  if (!name || typeof name !== 'string') {
    return 'Hello, stranger';
  }
  const total = add(name.length, 1);
  return `Hello, ${name.trim()} (${total} chars)`;
}

export function printGreeting(name, out = console) {
  out.log(greetingFor(name));
}
