import { intersectLineLine } from './geometry';

export interface Token {
  type: 'NUMBER' | 'IDENTIFIER' | 'PLUS' | 'MINUS' | 'STAR' | 'BANG' | 'COLON' | 'LPAREN' | 'RPAREN' | 'COMMA';
  value: string;
}

export type FormulaNode =
  | { type: 'coordinate'; xToken: string; yToken: string }
  | { type: 'polar'; angleToken: string; radiusToken: string }
  | { type: 'point_ref'; name: string }
  | { type: 'variable_ref'; name: string }
  | { type: 'number_literal'; value: string }
  | { type: 'binary_op'; op: '+' | '-'; left: FormulaNode; right: FormulaNode }
  | { type: 'scale'; factor: FormulaNode; expr: FormulaNode }
  | { type: 'ratio'; p1: FormulaNode; tToken: string; p2: FormulaNode }
  | { type: 'projection'; p1: FormulaNode; p2: FormulaNode; p3: FormulaNode }
  | { type: 'rotate'; p1: FormulaNode; dToken: string; angleToken: string; p2: FormulaNode }
  | { type: 'intersection'; p1Name: string; p2Name: string; p3Name: string; p4Name: string };

function normalizeFormula(formula: string): string {
  // Strip any '$' symbols completely to simplify nested parsing
  return formula.replace(/\$/g, '').trim();
}

export function tokenizeFormula(formula: string): Token[] {
  const norm = normalizeFormula(formula);
  const regex = /([0-9]*\.?[0-9]+(?:cm|pt|deg)?|\\?[a-zA-Z_][a-zA-Z0-9_]*|\+\+|--|[+\-*!:,()$])/g;
  const tokens: Token[] = [];
  let match;
  while ((match = regex.exec(norm)) !== null) {
    const val = match[0];
    if (val === '(') tokens.push({ type: 'LPAREN', value: val });
    else if (val === ')') tokens.push({ type: 'RPAREN', value: val });
    else if (val === '+') tokens.push({ type: 'PLUS', value: val });
    else if (val === '-') tokens.push({ type: 'MINUS', value: val });
    else if (val === '*') tokens.push({ type: 'STAR', value: val });
    else if (val === '!') tokens.push({ type: 'BANG', value: val });
    else if (val === ':') tokens.push({ type: 'COLON', value: val });
    else if (val === ',') tokens.push({ type: 'COMMA', value: val });
    else if (/^[0-9]/.test(val)) tokens.push({ type: 'NUMBER', value: val });
    else tokens.push({ type: 'IDENTIFIER', value: val });
  }
  return tokens;
}

export function parseFormula(formula: string): FormulaNode {
  const norm = formula.trim();
  const interRegex = /^\s*(?:\(\$)?intersection\s+of\s+([a-zA-Z0-9_]+)--([a-zA-Z0-9_]+)\s+and\s+([a-zA-Z0-9_]+)--([a-zA-Z0-9_]+)(?:\$\))?\s*$/i;
  const match = norm.match(interRegex);
  if (match) {
    return {
      type: 'intersection',
      p1Name: match[1],
      p2Name: match[2],
      p3Name: match[3],
      p4Name: match[4]
    };
  }

  const tokens = tokenizeFormula(formula);
  let index = 0;

  function peek(): Token | undefined {
    return tokens[index];
  }

  function next(): Token | undefined {
    return tokens[index++];
  }

  function consume(type: string, errMsg: string) {
    const t = peek();
    if (!t || t.type !== type) {
      throw new Error(errMsg + (t ? ` (found ${t.type} '${t.value}')` : ' (EOF)'));
    }
    return next()!;
  }

  function parseSignedValue(): string {
    let sign = '';
    if (peek()?.type === 'MINUS') {
      next();
      sign = '-';
    } else if (peek()?.type === 'PLUS') {
      next();
    }
    const valTok = next();
    if (!valTok || (valTok.type !== 'NUMBER' && valTok.type !== 'IDENTIFIER')) {
      throw new Error('Expected number or identifier inside coordinate');
    }
    return sign + valTok.value;
  }

  function parsePrimary(): FormulaNode {
    const t = peek();
    if (!t) throw new Error('Unexpected end of formula');

    if (t.type === 'NUMBER') {
      next();
      return { type: 'number_literal', value: t.value };
    }

    if (t.type === 'IDENTIFIER') {
      next();
      return { type: 'variable_ref', name: t.value };
    }

    if (t.type === 'MINUS') {
      next();
      const node = parsePrimary();
      return { type: 'scale', factor: { type: 'number_literal', value: '-1' }, expr: node };
    }

    if (t.type === 'PLUS') {
      next();
      return parsePrimary();
    }

    if (t.type === 'LPAREN') {
      next(); // consume '('
      const innerToken = peek();
      if (!innerToken) throw new Error('Unterminated parenthesis');

      // Scan inside matching parenthesis to see if we have a COMMA or COLON at level 1
      let level = 1;
      let hasComma = false;
      let hasColon = false;
      for (let i = index; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok.type === 'LPAREN') level++;
        else if (tok.type === 'RPAREN') {
          level--;
          if (level === 0) break;
        } else if (level === 1) {
          if (tok.type === 'COMMA') hasComma = true;
          else if (tok.type === 'COLON') hasColon = true;
        }
      }

      // 1. Polar coordinate ( angle : radius )
      if (hasColon) {
        const angleVal = parseSignedValue();
        consume('COLON', 'Expected colon in polar coordinate');
        const radiusVal = parseSignedValue();
        consume('RPAREN', 'Expected closing parenthesis for polar coordinate');
        return { type: 'polar', angleToken: angleVal, radiusToken: radiusVal };
      }

      // 2. Cartesian coordinate ( x , y )
      if (hasComma) {
        const xVal = parseSignedValue();
        consume('COMMA', 'Expected comma in coordinate');
        const yVal = parseSignedValue();
        consume('RPAREN', 'Expected closing parenthesis for coordinate');
        return { type: 'coordinate', xToken: xVal, yToken: yVal };
      }

      // 3. Point reference: ( IDENTIFIER )
      if (innerToken.type === 'IDENTIFIER' && tokens[index + 1]?.type === 'RPAREN') {
        const id = next()!.value;
        next(); // consume ')'
        return { type: 'point_ref', name: id };
      }

      // 4. General expression or nested calculation
      const expr = parseExpression();
      consume('RPAREN', 'Expected closing parenthesis for expression');
      return expr;
    }

    throw new Error(`Unexpected token in primary expression: ${t.value}`);
  }


  function parseFactor(): FormulaNode {
    let node = parsePrimary();

    while (peek()?.type === 'BANG') {
      next(); // consume '!'
      const arg1 = parsePrimary();
      
      if (peek()?.type === 'BANG') {
        next(); // consume second '!'
        const arg2 = parsePrimary();
        
        if (peek()?.type === 'COLON') {
          next(); // consume ':'
          const p2 = parsePrimary();
          
          node = {
            type: 'rotate',
            p1: node,
            dToken: arg1.type === 'number_literal' ? arg1.value : (arg1.type === 'variable_ref' ? arg1.name : '1'),
            angleToken: arg2.type === 'number_literal' ? arg2.value : (arg2.type === 'variable_ref' ? arg2.name : '0'),
            p2
          };
        } else {
          if (arg1.type === 'point_ref') {
            node = {
              type: 'projection',
              p1: node,
              p2: arg1,
              p3: arg2
            };
          } else {
            node = {
              type: 'ratio',
              p1: node,
              tToken: arg1.type === 'number_literal' ? arg1.value : (arg1.type === 'variable_ref' ? arg1.name : '0'),
              p2: arg2
            };
          }
        }
      } else {
        throw new Error('Incomplete TikZ calc syntax, expected second ! or : operator');
      }
    }

    return node;
  }

  function parseTerm(): FormulaNode {
    let node = parseFactor();

    while (peek()?.type === 'STAR') {
      next(); // consume '*'
      const right = parseFactor();
      node = { type: 'scale', factor: node, expr: right };
    }

    return node;
  }

  function parseExpression(): FormulaNode {
    let node = parseTerm();

    while (peek()?.type === 'PLUS' || peek()?.type === 'MINUS') {
      const opToken = next()!;
      const op = opToken.value as '+' | '-';
      const right = parseTerm();
      node = { type: 'binary_op', op, left: node, right };
    }

    return node;
  }

  const resultNode = parseExpression();
  if (index < tokens.length) {
    throw new Error(`Unexpected tokens remaining after parsing: ${tokens.slice(index).map(t => t.value).join(' ')}`);
  }
  return resultNode;
}

export function extractDependencies(node: FormulaNode): string[] {
  const deps = new Set<string>();

  function traverse(n: FormulaNode) {
    if (!n) return;
    if (n.type === 'point_ref') {
      deps.add(n.name);
    } else if (n.type === 'binary_op') {
      traverse(n.left);
      traverse(n.right);
    } else if (n.type === 'scale') {
      traverse(n.factor);
      traverse(n.expr);
    } else if (n.type === 'ratio') {
      traverse(n.p1);
      traverse(n.p2);
    } else if (n.type === 'projection') {
      traverse(n.p1);
      traverse(n.p2);
      traverse(n.p3);
    } else if (n.type === 'rotate') {
      traverse(n.p1);
      traverse(n.p2);
    } else if (n.type === 'intersection') {
      deps.add(n.p1Name);
      deps.add(n.p2Name);
      deps.add(n.p3Name);
      deps.add(n.p4Name);
    }
  }

  traverse(node);
  return Array.from(deps);
}

export function evalNumber(token: string, variables: Map<string, number>): { value: number; hasUnit: boolean } {
  const cleanToken = token.trim();

  let varName = cleanToken;
  if (varName.startsWith('\\')) {
    varName = varName.substring(1);
  }
  if (variables.has(varName)) {
    return { value: variables.get(varName)!, hasUnit: false };
  }
  if (variables.has(cleanToken)) {
    return { value: variables.get(cleanToken)!, hasUnit: false };
  }

  const numMatch = cleanToken.match(/^([-+]?[0-9]*\.?[0-9]+)([a-zA-Z]*)$/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    const unit = numMatch[2].toLowerCase();
    const hasUnit = unit === 'cm' || unit === 'pt' || unit === 'in' || unit === 'mm';
    return { value: val, hasUnit };
  }

  return { value: 0, hasUnit: false };
}

export function evaluateNode(
  node: FormulaNode,
  computedPoints: Map<string, { x: number; y: number }>,
  variables: Map<string, number>
): { x: number; y: number } {
  switch (node.type) {
    case 'point_ref': {
      const pt = computedPoints.get(node.name);
      if (!pt) throw new Error(`Point "${node.name}" referenced but not yet evaluated`);
      return pt;
    }

    case 'coordinate': {
      const x = evalNumber(node.xToken, variables).value;
      const y = evalNumber(node.yToken, variables).value;
      return { x, y };
    }

    case 'polar': {
      const angle = evalNumber(node.angleToken, variables).value;
      const radius = evalNumber(node.radiusToken, variables).value;
      const rad = (angle * Math.PI) / 180;
      return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
    }

    case 'binary_op': {
      const left = evaluateNode(node.left, computedPoints, variables);
      const right = evaluateNode(node.right, computedPoints, variables);
      if (node.op === '+') {
        return { x: left.x + right.x, y: left.y + right.y };
      } else {
        return { x: left.x - right.x, y: left.y - right.y };
      }
    }

    case 'scale': {
      let factorVal = 1;
      if (node.factor.type === 'number_literal') {
        factorVal = evalNumber(node.factor.value, variables).value;
      } else if (node.factor.type === 'variable_ref') {
        factorVal = evalNumber(node.factor.name, variables).value;
      } else {
        const fRes = evaluateNode(node.factor, computedPoints, variables);
        factorVal = fRes.x;
      }
      const exprRes = evaluateNode(node.expr, computedPoints, variables);
      return { x: factorVal * exprRes.x, y: factorVal * exprRes.y };
    }

    case 'ratio': {
      const p1 = evaluateNode(node.p1, computedPoints, variables);
      const p2 = evaluateNode(node.p2, computedPoints, variables);
      const { value: t, hasUnit } = evalNumber(node.tToken, variables);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const d = Math.hypot(dx, dy);
      if (hasUnit) {
        if (d === 0) return p1;
        const dirX = dx / d;
        const dirY = dy / d;
        return { x: p1.x + t * dirX, y: p1.y + t * dirY };
      } else {
        return { x: p1.x + t * dx, y: p1.y + t * dy };
      }
    }

    case 'projection': {
      const p1 = evaluateNode(node.p1, computedPoints, variables);
      const p2 = evaluateNode(node.p2, computedPoints, variables);
      const p3 = evaluateNode(node.p3, computedPoints, variables);
      const dirX = p3.x - p1.x;
      const dirY = p3.y - p1.y;
      const d = Math.hypot(dirX, dirY);
      if (d === 0) return p1;
      const ux = dirX / d;
      const uy = dirY / d;
      const vx = p2.x - p1.x;
      const vy = p2.y - p1.y;
      const dot = vx * ux + vy * uy;
      return { x: p1.x + dot * ux, y: p1.y + dot * uy };
    }

    case 'rotate': {
      const p1 = evaluateNode(node.p1, computedPoints, variables);
      const p2 = evaluateNode(node.p2, computedPoints, variables);
      const { value: d, hasUnit } = evalNumber(node.dToken, variables);
      const angle = evalNumber(node.angleToken, variables).value;
      const dirX = p2.x - p1.x;
      const dirY = p2.y - p1.y;
      const len = Math.hypot(dirX, dirY);
      if (len === 0) return p1;
      const ux = dirX / len;
      const uy = dirY / len;
      const rad = (angle * Math.PI) / 180;
      const rx = ux * Math.cos(rad) - uy * Math.sin(rad);
      const ry = ux * Math.sin(rad) + uy * Math.cos(rad);
      const scale = hasUnit ? d : d * len;
      return { x: p1.x + scale * rx, y: p1.y + scale * ry };
    }

    case 'intersection': {
      const p1 = computedPoints.get(node.p1Name);
      const p2 = computedPoints.get(node.p2Name);
      const p3 = computedPoints.get(node.p3Name);
      const p4 = computedPoints.get(node.p4Name);
      if (!p1 || !p2 || !p3 || !p4) {
        throw new Error(`One or more intersection line endpoints are missing/unevaluated`);
      }
      const inter = intersectLineLine(p1, p2, p3, p4);
      if (!inter) {
        throw new Error(`Lines ${node.p1Name}--${node.p2Name} and ${node.p3Name}--${node.p4Name} are parallel, no intersection`);
      }
      return inter;
    }

    default:
      throw new Error(`Unknown AST node type: ${(node as any).type}`);
  }
}
