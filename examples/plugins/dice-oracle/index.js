/*
 * Dice Oracle - sample RuneSlate plugin.
 * Classic script (no imports); talks to RuneSlate only through window.runeSlateApi.
 */
(function () {
  'use strict';

  var api = window.runeSlateApi;
  if (!api) return;

  /** d20 → answer. */
  function answerFor(roll) {
    if (roll === 1) return 'No, and things get worse.';
    if (roll <= 6) return 'No.';
    if (roll <= 9) return 'No, but...';
    if (roll <= 12) return 'Yes, but...';
    if (roll <= 19) return 'Yes.';
    return 'Yes, and something good happens!';
  }

  function ask() {
    var dice = api.rollDice('1d20');
    var result = { roll: dice.result, answer: answerFor(dice.result), at: Date.now() };
    // Shared between widget instances and the background runtime.
    api.storage.set('lastAnswer', result).catch(function (err) {
      console.warn('[dice-oracle] could not store answer', err);
    });
    return result;
  }

  function pushToStage(result) {
    api.updateStageOverlay({
      title: 'The Oracle speaks',
      lines: [result.answer, '(d20: ' + result.roll + ')'],
      position: 'bottom-left'
    });
  }

  // Commands run in the invisible background runtime (and in widgets, whichever the host routes to).
  api.commands.register('ask-oracle', function () {
    pushToStage(ask());
  });

  var isWidget = document.documentElement.getAttribute('data-rs-mode') !== 'background';
  if (!isWidget) return;

  /* --------------------------------------------------------- widget UI */

  var root = document.getElementById('root');
  root.style.cssText =
    'box-sizing:border-box;height:100vh;padding:12px;display:flex;flex-direction:column;gap:8px;' +
    'font:14px/1.4 system-ui,sans-serif;color:#e4e4e7;background:#18181b;border-radius:8px;';

  var title = document.createElement('div');
  title.textContent = 'Dice Oracle';
  title.style.cssText = 'font-weight:600;color:#fcd34d;letter-spacing:.02em;';

  var answer = document.createElement('div');
  answer.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;text-align:center;font-size:16px;';
  answer.textContent = 'Ask a yes/no question...';

  var rollInfo = document.createElement('div');
  rollInfo.style.cssText = 'font-size:12px;color:#a1a1aa;text-align:center;min-height:16px;';

  var buttons = document.createElement('div');
  buttons.style.cssText = 'display:flex;gap:6px;';

  function makeButton(label, primary) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText =
      'flex:1;padding:6px 8px;border-radius:6px;border:1px solid #3f3f46;cursor:pointer;font:inherit;' +
      (primary ? 'background:#f59e0b;color:#18181b;font-weight:600;' : 'background:#27272a;color:#e4e4e7;');
    return b;
  }

  var askButton = makeButton('Roll d20', true);
  var stageButton = makeButton('To Stage', false);
  var clearButton = makeButton('Clear', false);
  buttons.append(askButton, stageButton, clearButton);
  root.append(title, answer, rollInfo, buttons);

  var current = null;

  function render(state) {
    if (!state || typeof state !== 'object' || typeof state.answer !== 'string') return;
    current = state;
    answer.textContent = state.answer;
    rollInfo.textContent = 'd20: ' + state.roll;
  }

  askButton.addEventListener('click', function () {
    var result = ask();
    render(result);
    api.widget.setState(result);
  });
  stageButton.addEventListener('click', function () {
    if (current) pushToStage(current);
  });
  clearButton.addEventListener('click', function () {
    api.updateStageOverlay(null);
  });

  // Initial state arrives with the host's init message (after this script ran).
  render(api.widget.getState());
  api.widget.onStateChange(render);
})();
