(function (global) {
  'use strict';

  function mount(root, ctx) {
    root.innerHTML = '<div class="march"><div class="sky"></div><div class="ridge"></div><div class="trail"></div><div class="history">1935.5.29 · 飞夺泸定桥后</div><div class="supply">炊事桶 · 铜提盒 · 医疗箱</div><div class="goal">铁索终点</div><div class="mud" style="left:260px;top:450px"></div><div class="mud" style="left:450px;top:320px"></div><div class="mud" style="left:640px;top:500px"></div><div class="mud" style="left:800px;top:350px"></div><div class="mud" style="left:990px;top:230px"></div><div class="runner"><i></i><b></b><em></em></div><div class="help">WASD / 方向键移动 · 躲开泥坑，抵达终点</div></div>';
    var player = root.querySelector('.runner'), x = 70, y = 560, ended = false;
    var pits = [[260, 450], [450, 320], [640, 500], [800, 350], [990, 230]];
    function draw() { player.style.left = x + 'px'; player.style.top = y + 'px'; }
    ctx.hint('使用 WASD 或方向键移动，避开泥坑并抵达铁索终点。');
    ctx.on(root, 'pointerdown', function () { root.focus(); });
    root.tabIndex = 0;
    ctx.on(root, 'keydown', function (e) {
      if (ended) return;
      var key = e.key.toLowerCase(), dx = 0, dy = 0;
      if (key === 'arrowup' || key === 'w') dy = -22;
      else if (key === 'arrowdown' || key === 's') dy = 22;
      else if (key === 'arrowleft' || key === 'a') dx = -22;
      else if (key === 'arrowright' || key === 'd') dx = 22;
      else return;
      e.preventDefault();
      var nx = Math.max(34, Math.min(1246, x + dx)), ny = Math.max(50, Math.min(670, y + dy));
      for (var i = 0; i < pits.length; i++) {
        var px = nx - pits[i][0], py = ny - pits[i][1];
        if (px * px / 8464 + py * py / 4096 < 1) { ended = true; ctx.fail('陷入泥坑'); return; }
      }
      x = nx; y = ny; draw();
      if (x > 1160 && y < 190) { ended = true; ctx.finish(100); }
    });
    draw();
  }

  global.LEVEL = { mount: mount };
})(window);
