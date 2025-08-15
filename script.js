
let current = "0";
let resultDisplayed = false;
let degreeMode = true; // DEG by default


const screen = document.getElementById("screen");
const calcEl = document.getElementById("calc");
const modeToggle = document.getElementById("mode");


function updateScreen(value) {
  screen.textContent = value;
}
function isOperator(char) {
  return ['+', '-', '*', '/', '^'].includes(char);
}


modeToggle.addEventListener("change", () => {
  calcEl.classList.toggle("scientific", modeToggle.checked);
});

// DEG/RAD toggle (button label/title)
function toggleDegRad(btn){
  degreeMode = !degreeMode;
  btn.textContent = degreeMode ? "DEG" : "RAD";
  btn.title = degreeMode ? "(Degrees)" : "(Radians)";
}

// ===== Input handling =====
function handleInput(value) {
  if (current === "Error") current = "0";

  if (resultDisplayed) {

    if (!(isOperator(value) || value === "^" || value === ")")) {
      current = "0";
    }
    resultDisplayed = false;
  }

  const lastChar = current[current.length - 1];

  if (isOperator(value)) {
    if (isOperator(lastChar)) {
      current = current.slice(0, -1) + value;
    } else {
      current += value;
    }
  } else if (value === ".") {
    const parts = current.split(/[\+\-\*\/\^\(\),%]/);
    const lastPart = parts[parts.length - 1];
    if (!lastPart.includes(".")) current += value;
  } else if (value === "%") {
    insertPercent();
  } else {
    if (current === "0" && !isOperator(value) && value !== "." && value !== ")" ) {
      current = value;
    } else {
      current += value;
    }
  }

  updateScreen(current);
}

function insertPercent(){
  // Show % on screen; do not evaluate now.
  // Allow percent only after a valid token (number, π, ℯ, ), !, or closing of function)
  const last = current.slice(-1);
  if (!last || last === "(" || isOperator(last) || last === "," ) return;
  if (last === "%") return; 
  current += "%";
}

function handleInsert(text){

  if (resultDisplayed && /[a-zA-Zπℯ\(]/.test(text)) {
    current = "0";
    resultDisplayed = false;
  }
  if (current === "0" && /[^\.\)\+\-\*\/\^%]/.test(text)) current = "";
  current += text;
  updateScreen(current);
}

function handleBackspace() {
  if (current === "Error" || resultDisplayed) {
    current = "0";
  } else {
    current = current.slice(0, -1) || "0";
  }
  updateScreen(current);
}

function handleClear() {
  current = "0";
  resultDisplayed = false;
  updateScreen(current);
}

function handleFactorial(){
  if (current === "0") return;
  const last = current.slice(-1);
  // only add ! if last is a number/)/π/ℯ/%/!
  if (/[0-9\)\πℯ%!]/.test(last)) {
    current += "!";
    updateScreen(current);
  }
}


function toRadians(x){ return degreeMode ? (x * Math.PI / 180) : x; }
function fact(n){
  if (!isFinite(n) || n < 0 || Math.floor(n) !== n) return NaN;
  if (n > 170) return Infinity; // prevent overflow
  let res = 1;
  for (let i=2;i<=n;i++) res *= i;
  return res;
}

function replaceFactorials(expr){

  function replaceOnce(s){
    const idx = s.indexOf('!');
    if (idx === -1) return s;
    let end = idx - 1;
    if (end < 0) return s;

    if (s[end] === ')'){

      let depth = 0, start = end;
      for (; start >= 0; start--){
        if (s[start] === ')') depth++;
        else if (s[start] === '(') {
          depth--;
          if (depth === 0) break;
        }
      }
      if (start >= 0){
        
        let fnStart = start;
        while (fnStart-1 >= 0 && /[a-zA-Z_]/.test(s[fnStart-1])) fnStart--;
        const inside = s.slice(fnStart, end+1); 
        const wrap = inside.startsWith("(") ? "fact" + inside : "fact(" + inside + ")";
        return s.slice(0, fnStart) + wrap + s.slice(idx+1);
      }
      return s;
    } else {
      
      let start = end;
      while (start >= 0 && /[0-9.\wπℯ]/.test(s[start])) start--;
      start++;
      const token = s.slice(start, end+1);
      return s.slice(0, start) + "fact(" + token + ")" + s.slice(idx+1);
    }
  }
  let prev;
  do { prev = expr; expr = replaceOnce(expr); } while (expr.includes('!') && expr !== prev);
  return expr;
}


function transformPercents(s){
  function findOperandLeft(str, pos){
    let i = pos - 1;
    if (i < 0) return null;

    
    if (str[i] === ')'){
      let depth = 0, j = i;
      for (; j >= 0; j--){
        if (str[j] === ')') depth++;
        else if (str[j] === '('){
          depth--;
          if (depth === 0) break;
        }
      }
      if (j < 0) return null;
      
      let fnStart = j;
      while (fnStart - 1 >= 0 && /[a-zA-Z_]/.test(str[fnStart - 1])) fnStart--;
      return { start: fnStart, end: i, text: str.slice(fnStart, i+1) };
    }

    
    let j = i;
    while (j >= 0 && /[0-9.\wπℯ]/.test(str[j])) j--;
    j++;
    if (j > i) return null;
    return { start: j, end: i, text: str.slice(j, i+1) };
  }


  function findPrevOp(str, start){
    let depth = 0;
    for (let k = start - 1; k >= 0; k--){
      const ch = str[k];
      if (ch === ')') depth++;
      else if (ch === '(') depth--;
      else if (depth === 0 && (ch === '+' || ch === '-' || ch === '*' || ch === '/')){
        
        const prev = str[k-1];
        if (ch === '-' && (k === 0 || ['+','-','*','/','('].includes(prev))) {
          continue; 
        }
        return { op: ch, index: k };
      }
    }
    return null;
  }

  let out = s;
  let safety = 0;
  while (out.includes('%') && safety < 500){
    safety++;
    const idx = out.indexOf('%');
    const operand = findOperandLeft(out, idx);
    if (!operand){
      
      out = out.slice(0, idx) + "/100" + out.slice(idx+1);
      continue;
    }

    const leftOp = findPrevOp(out, operand.start);
    const after = out.slice(idx+1);

    if (!leftOp){
      // Standalone: X% -> (X/100)
      const before = out.slice(0, operand.start);
      const repl = "((" + operand.text + ")/100)";
      out = before + repl + after;
    } else {
      const A = out.slice(0, leftOp.index);     
      const op = leftOp.op;
      
      if (op === '+' || op === '-') {
      
        const leftPrefix = out.slice(0, leftOp.index); 
        const rightRest = after; 
        out = leftPrefix + op + "((" + leftPrefix + ")*(" + operand.text + ")/100)" + rightRest;
      } else {
        
        const leftPrefix = out.slice(0, leftOp.index); 
        const rightRest = after;
        out = leftPrefix + op + "((" + operand.text + ")/100)" + rightRest;
      }
    }
  }
  return out;
}


function evaluateExpression(expr){
  try{
    let s = expr;

  
    s = s.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-');

    
    s = s.replace(/(\d|\)|π|ℯ)(?=\()/g, '$1*');
    s = s.replace(/(\d|\)|π|ℯ)(?=[a-zA-Z])/g, '$1*');
    s = s.replace(/\)(?=\d)/g, ')*');

  
    s = replaceFactorials(s);


    s = transformPercents(s);

    
    s = s.replace(/π/g, 'PI');      
    s = s.replace(/ℯ/g, 'E');       

    
    s = s.replace(/\bsqrt\s*\(/gi, 'SQRT(');
    s = s.replace(/\bln\s*\(/gi, 'LN(');
    // log => base 10
    s = s.replace(/\blog\s*\(/gi, 'LOG10(');


    s = s.replace(/\bsin\s*\(/gi, 'DSIN(');
    s = s.replace(/\bcos\s*\(/gi, 'DCOS(');
    s = s.replace(/\btan\s*\(/gi, 'DTAN(');

  
    s = s.replace(/\^/g, '**');

  
    const fn = Function(
      'DSIN','DCOS','DTAN','LOG10','LN','SQRT','fact','PI','E',
      'return (' + s + ')'
    );

    const result = fn(
      (x)=>Math.sin(toRadians(x)),
      (x)=>Math.cos(toRadians(x)),
      (x)=>Math.tan(toRadians(x)),
      (x)=>Math.log10(x),
      (x)=>Math.log(x),
      (x)=>Math.sqrt(x),
      fact,
      Math.PI,
      Math.E
    );

    if (!isFinite(result)) throw new Error("Not finite");
    current = result.toString();
  } catch(e){
    current = "Error";
  }
  updateScreen(current);
  resultDisplayed = true;
}

// ===== Events: Buttons =====
document.querySelectorAll(".btn").forEach(button => {
  button.addEventListener("click", () => {
    const value = button.dataset.value;
    const action = button.dataset.action;
    const insert = button.dataset.insert;
    const func = button.dataset.func;

    if (value !== undefined) {
      
      handleInput(value);

    } else if (insert !== undefined){
      if (insert === '^2'){
      
        handleInsert('**2');
      } else {
        handleInsert(insert);
      }

    } else if (func){
      if (func === "degRadToggle"){ toggleDegRad(button); }
      if (func === "factorial"){ handleFactorial(); }

    } else if (action === "equals") {
      evaluateExpression(current);
    } else if (action === "clear") {
      handleClear();
    } else if (action === "backspace") {
      handleBackspace();
    }
  });
});


document.addEventListener("keydown", (e) => {
  const key = e.key;

  // Shortcuts
  if (key === "Enter" || key === "=") { e.preventDefault(); evaluateExpression(current); return; }
  if (key === "Backspace") { handleBackspace(); return; }
  if (key === "Escape") { handleClear(); return; }

  
  if (/^[0-9+\-*/.^()!,%]$/.test(key)) {
    handleInput(key);
    return;
  }

  // Letters: allow typing functions like sin, cos, tan, ln, log, sqrt, pi
  if (/^[a-zA-Z]$/.test(key)) {
    if (current === "0" && !resultDisplayed) current = "";
    if (resultDisplayed){ current = ""; resultDisplayed=false; }
    current += key;
    updateScreen(current);
    return;
  }


  if ((e.altKey || e.metaKey) && (key.toLowerCase() === 'p')){
    handleInsert('π'); return;
  }
});
