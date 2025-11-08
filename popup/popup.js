const ROWS = 6; // 6 attempts like original Wordle
const COLS = 5;


const boardEl = document.getElementById('board');
const keyboardEl = document.querySelector('.keyboard');
let messageEl = document.getElementById('message');

// If message element doesn't exist, create it
if (!messageEl) {
	messageEl = document.createElement('div');
	messageEl.id = 'message';
	messageEl.style.position = 'absolute';
	messageEl.style.top = '10px';
	messageEl.style.left = '50%';
	messageEl.style.transform = 'translateX(-50%)';
	messageEl.style.zIndex = '100';
	messageEl.style.background = 'rgba(0,0,0,0.7)';
	messageEl.style.color = '#fff';
	messageEl.style.padding = '6px 16px';
	messageEl.style.borderRadius = '8px';
	messageEl.style.fontSize = '1rem';
	messageEl.style.opacity = '0';
	messageEl.style.transition = 'opacity 0.3s, transform 0.3s';
	document.body.appendChild(messageEl);
}

let solution = null; // must fetch daily solution
let guesses = []; // array of strings
let curRow = 0;
let curCol = 0;
let locked = false; // when true, user cannot input (fetch failed or already played)

function formatDate(d = new Date()){
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth()+1).padStart(2,'0');
	const dd = String(d.getDate()).padStart(2,'0');
	return `${yyyy}-${mm}-${dd}`;
}

function storageKey() {
	return `wordle-popup-${formatDate()}`;
}

function solutionKey(){
	return `wordle-solution-${formatDate()}`;
}

function playedKey(){
	return `wordle-played-${formatDate()}`;
}

async function fetchSolutionForToday(){
	const date = formatDate();
	const url = `https://www.nytimes.com/svc/wordle/v2/${date}.json`;
		try{
			const res = await fetch(url);
			if(!res.ok) throw new Error('bad response');
			const data = await res.json();
			if(data && data.solution) return data.solution.toLowerCase();
			if(Array.isArray(data) && data[0] && data[0].solution) return data[0].solution.toLowerCase();
			console.warn('Unexpected NYT payload', data);
			return null;
		}catch(e){
			console.warn('Failed to fetch NYT wordle:', e);
			return null;
		}
}

function buildBoard(){
	boardEl.innerHTML = '';
	for(let r=0;r<ROWS;r++){
		const row = document.createElement('div');
		row.className = 'row';
		row.dataset.r = r;
		for(let c=0;c<COLS;c++){
			const cell = document.createElement('div');
			cell.className = 'cell';
			cell.dataset.r = r;
			cell.dataset.c = c;
			// Start with empty content
			cell.textContent = '';
			row.appendChild(cell);
		}
		boardEl.appendChild(row);
	}
}

function buildKeyboard(){
	keyboardEl.innerHTML = '';
	const rows = ['qwertyuiop','asdfghjkl','zxcvbnm'];
	rows.forEach((rstr,ri)=>{
		const row = document.createElement('div');
		row.className = 'key-row';
		for(const ch of rstr){
			row.appendChild(keyButton(ch));
		}
		if(ri===1){
			// Remove button at end of second row
			row.appendChild(keyButton('⌫','Backspace','large remove'));
		}
		if(ri===2){
			// Enter button at end of third row, with arrow
			row.appendChild(keyButton('→','Enter','large enter'));
		}
		keyboardEl.appendChild(row);
	});
}

function keyButton(label,code,cls){
	const btn = document.createElement('button');
	btn.className = 'key' + (cls?` ${cls}`:'');
	btn.textContent = label;
	btn.dataset.code = code || label;
	btn.addEventListener('click', (e)=>{ 
		e.preventDefault();
		if(!locked) {
			onKey(btn.dataset.code); 
			// Add visual feedback
			btn.style.transform = 'scale(0.95)';
			setTimeout(() => {
				btn.style.transform = '';
			}, 100);
		}
	});
	return btn;
}

function onKey(code){
	if(code === 'Enter') return onEnter();
	if(code === 'Backspace') return onBackspace();
	if(typeof code === 'string' && code.length===1 && /[a-zA-Z]/.test(code)){
		putLetter(code.toLowerCase());
	}
}

function putLetter(letter){
	if(locked) return;
	if(curCol >= COLS) return;
	const cell = document.querySelector(`.cell[data-r='${curRow}'][data-c='${curCol}']`);
	
	// Add animation effect
	cell.style.transform = 'scale(1.1)';
	setTimeout(() => {
		cell.style.transform = '';
	}, 150);
	
	cell.textContent = letter.toUpperCase();
	cell.classList.add('filled');
	curCol++;
}

function onBackspace(){
	if(locked) return;
	if(curCol <= 0) return;
	curCol--;
	const cell = document.querySelector(`.cell[data-r='${curRow}'][data-c='${curCol}']`);
	
	// Add animation effect
	cell.style.transform = 'scale(0.9)';
	setTimeout(() => {
		cell.style.transform = '';
	}, 150);
	
	cell.textContent = '';
	cell.classList.remove('filled');
}

function getGuessAtRow(r){
	let s='';
	for(let c=0;c<COLS;c++){
		const cell = document.querySelector(`.cell[data-r='${r}'][data-c='${c}']`);
		s += (cell.textContent || '');
	}
	return s;
}

function showMessage(txt,timeout=2000){
	messageEl.textContent = txt;
	messageEl.style.opacity = '1';
	messageEl.style.transform = 'translateY(0)';
	// If win, persist message in localStorage
	if (txt === 'You win! 🎉' || txt === 'You Win') {
		try { localStorage.setItem('wordle-win-message', 'You Win'); } catch(e) {}
	} else if (txt && txt !== 'You Win') {
		try { localStorage.removeItem('wordle-win-message'); } catch(e) {}
	}
	if(timeout && txt !== 'You Win') {
		setTimeout(()=>{ 
			if(messageEl.textContent===txt) {
				messageEl.style.opacity = '0';
				messageEl.style.transform = 'translateY(-10px)';
				setTimeout(() => {
					if(messageEl.textContent===txt) messageEl.textContent='';
				}, 300);
			}
		}, timeout);
	}
}

function evaluateGuess(guess, solutionStr){
	// ensure both guess and solution are lowercase for comparison
	guess = guess.toLowerCase();
	solutionStr = solutionStr.toLowerCase();
	const res = Array(COLS).fill('absent');
	const solArr = solutionStr.split('');
	// first pass: correct
	for(let i=0;i<COLS;i++){
		if(guess[i] === solArr[i]){
			res[i] = 'correct';
			solArr[i] = null;
		}
	}
	// second pass: present
	for(let i=0;i<COLS;i++){
		if(res[i] === 'correct') continue;
		const idx = solArr.indexOf(guess[i]);
		if(idx !== -1){
			res[i] = 'present';
			solArr[idx] = null;
		}
	}
	return res;
}

function applyResultToRow(r, statuses){
	for(let c=0;c<COLS;c++){
		const cell = document.querySelector(`.cell[data-r='${r}'][data-c='${c}']`);
		
		// Add staggered animation delay
		setTimeout(() => {
			cell.classList.remove('filled');
			cell.classList.add(statuses[c]);
		}, c * 100);
	}
}

function updateKeyboard(guess, statuses){
	for(let i=0;i<guess.length;i++){
		const letter = guess[i].toLowerCase();
		const btn = Array.from(document.querySelectorAll('.key')).find(b=>b.textContent.toLowerCase()===letter);
		if(!btn) continue;
		// priority: correct > present > absent
		if(statuses[i]==='correct'){
			btn.classList.remove('present','absent');
			btn.classList.add('correct');
		}else if(statuses[i]==='present'){
			if(!btn.classList.contains('correct')){
				btn.classList.remove('absent');
				btn.classList.add('present');
			}
		}else{
			if(!btn.classList.contains('correct') && !btn.classList.contains('present')){
				btn.classList.add('absent');
			}
		}
	}
}

function saveState(){
	// sanitize guesses before saving: only keep A-Z letters, no spaces or other chars
	try{
		const sanitized = guesses.map(g => typeof g === 'string' ? g.replace(/[^a-zA-Z]/g,'') : '');
		const payload = { guesses: sanitized, curRow, curCol };
		localStorage.setItem(storageKey(), JSON.stringify(payload));
	}catch(e){/*ignore*/}
}

function loadState(){
	try{
		const raw = localStorage.getItem(storageKey());
		if(!raw) return;
		const obj = JSON.parse(raw);
		if(obj && Array.isArray(obj.guesses)){
			// sanitize incoming guesses: remove spaces and any non-letter characters
			const sanitized = obj.guesses.map(g => typeof g === 'string' ? g.replace(/[^a-zA-Z]/g,'') : '');
			guesses = sanitized.slice(0, ROWS);

			// render guesses
			for(let r=0;r<guesses.length && r<ROWS;r++){
				const g = guesses[r] || '';
				for(let c=0;c<COLS;c++){
					const ch = (g[c] && /[a-zA-Z]/.test(g[c])) ? g[c] : '';
					const cell = document.querySelector(`.cell[data-r='${r}'][data-c='${c}']`);
					if(cell){ cell.textContent = ch ? ch.toUpperCase() : ''; if(ch) cell.classList.add('filled'); }
				}
				// apply previous coloring if solution known and row is complete
				if(solution && g && g.length === COLS) {
					const st = evaluateGuess(g, solution);
					applyResultToRow(r, st);
					updateKeyboard(g, st);
				}
			}

			// compute current cursor (first empty cell in first incomplete row)
			let found = false;
			for(let r=0;r<ROWS;r++){
				let filled = 0;
				for(let c=0;c<COLS;c++){
					const cell = document.querySelector(`.cell[data-r='${r}'][data-c='${c}']`);
					if(cell && cell.textContent && cell.textContent.trim() !== '') filled++;
				}
				if(filled < COLS){
					curRow = r;
					curCol = filled;
					found = true;
					break;
				}
			}
			if(!found){ curRow = guesses.length; curCol = 0; }
		}
	}catch(e){console.warn('loadState failed',e)}
}

async function onEnter(){
	if(locked) return;
	if(curCol < COLS){ showMessage('Not enough letters'); return; }
	const guess = getGuessAtRow(curRow);
	if(guess.length !== COLS) return;
	// basic validation: letters only
	if(!/^[a-zA-Z]{5}$/.test(guess)) { showMessage('Invalid guess'); return; }

	// evaluate
	const statuses = evaluateGuess(guess, solution);
	applyResultToRow(curRow, statuses);
	updateKeyboard(guess, statuses);

	guesses[curRow] = guess;
	saveState();

		if(guess.toLowerCase() === solution.toLowerCase()){
			showMessage('You Win');
			curRow = ROWS; // lock further input
			// mark as played for today
			try{ localStorage.setItem(playedKey(),'true'); }catch(e){}
			locked = true;
			return;
		}

	curRow++;
	curCol = 0;
		if(curRow >= ROWS){
			showMessage(`Out of guesses — solution: ${solution.toUpperCase()}`, 5000);
			try{ localStorage.setItem(playedKey(),'true'); }catch(e){}
			locked = true;
		}
}

function resetGameLocal(){
	if(localStorage.getItem(playedKey()) === 'true'){
		return;
	}
	guesses = [];
	curRow = 0; curCol = 0;
	localStorage.removeItem(storageKey());
	buildBoard();
	loadState();
	// Show win message if previously won
	const winMsg = localStorage.getItem('wordle-win-message');
	if (winMsg === 'You Win') {
		showMessage('You Win', 0);
		messageEl.style.opacity = '1';
		messageEl.style.transform = 'translateY(0)';
	}
}

async function init(){
	buildBoard();
	buildKeyboard();
		// attempt to fetch solution — prefer a live fetch, but fall back to cached solution so keys work
		const fetched = await fetchSolutionForToday();
		if(fetched){
			solution = fetched;
			try{ localStorage.setItem(solutionKey(), fetched); }catch(e){}
		}else{
			// try cached solution from earlier successful fetch
			const cached = localStorage.getItem(solutionKey());
			if(cached){
				solution = cached;
				showMessage("Offline: using cached solution",3000);
			}else{
				// No solution available; allow play with a fallback so keyboard is usable, but notify the user
				solution = 'crane';
				showMessage(`Offline: using fallback solution`,4000);
			}
		}

		// Load any saved board state first (so we can validate whether the "played" flag is legitimate)
		loadState();

		// If the user already played today, only lock input when the saved state actually
		// indicates the game is finished (win or out of guesses). This avoids a stale
		// played flag blocking input when the popup was simply closed mid-game.
		try{
			const pk = localStorage.getItem(playedKey());
			if(pk === 'true'){
				const hasWon = guesses.some(g => typeof g === 'string' && g.toLowerCase() === (solution || '').toLowerCase());
				if(hasWon || curRow >= ROWS){
					locked = true;
				}else{
					// Inconsistent: clear the played flag so the user can continue playing
					try{ localStorage.removeItem(playedKey()); }catch(e){}
					locked = false;
				}
			}
		}catch(e){console.warn('playedKey check failed', e)}

		// If the user previously won, persistently show the win message when the popup opens
		try{
			const winMsg = localStorage.getItem('wordle-win-message');
			if(winMsg === 'You Win'){
				// show without timeout so it stays visible while popup is open
				showMessage('You Win', 0);
				messageEl.style.opacity = '1';
				messageEl.style.transform = 'translateY(0)';
			}
		}catch(e){/*ignore*/}

	// Enhanced keyboard physical input
	document.addEventListener('keydown', (e)=>{
		// Prevent default behavior for game keys
		if(['Enter', 'Backspace'].includes(e.key) || /^[a-zA-Z]$/.test(e.key)) {
			e.preventDefault();
		}
		
		if(locked) return; // Don't process keys when locked
		
		if(e.key === 'Enter') onEnter();
		else if(e.key === 'Backspace') onBackspace();
		else if(/^[a-zA-Z]$/.test(e.key)) putLetter(e.key.toLowerCase());
	});
	
	// Ensure immediate focus and input handling
	window.addEventListener('load', () => {
		document.body.focus();
	});
	
	// Auto-focus when popup becomes visible
	document.addEventListener('DOMContentLoaded', () => {
		setTimeout(() => {
			document.body.focus();
		}, 100);
	});
	
	// Handle focus loss and regain
	window.addEventListener('focus', () => {
		document.body.focus();
	});
	
	// Immediate focus on init
	document.body.focus();

			// New button removed — no event listener
}

init();

