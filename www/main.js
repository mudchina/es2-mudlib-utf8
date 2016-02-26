var ROOM_MARK = '▲ ', CHAR_MARK = '▼ ', ITEM_MARK = '◆ ';

// TODO: parse exits, enable / disable go keys
function parseRoom(str) {
  var marks = str.split(ROOM_MARK);
  for(var i=1; i<marks.length; i++) {
    var desc = marks[i];
  }
  return str;
}

// TODO: find NPC id,
// 1. set as default target
// 2. show context-sensitive commands
function parseChar(str) {
  var marks = str.split(CHAR_MARK);
  for(var i=1; i<marks.length; i++) {
    var desc = marks[i];
  }
  return str;
}

// TODO: find Item id,
// 1. set as default target
// 2. show context-sensitive commands
function parseItem(str) {
  var marks = str.split(ITEM_MARK);
  for(var i=1; i<marks.length; i++) {
    var desc = marks[i];
  }
  return str;
}

function scrollDown() {
  var out = $('div#out');
  out.scrollTop(out.prop("scrollHeight"));
}

function writeToScreen(str) {
  $('div#out').append('<span class="out">' + str + '</span>');
  scrollDown();
}

var LOGIN_MARK = '您的英文名字：', PASS_MARK = '请输入密码：';
var askingLogin = false, askingPass = false, autologin = false;

function writeServerData(buf) {
  var data = new Uint8Array(buf);
  var str = binayUtf8ToString(data, 0);

  if(str.indexOf(ROOM_MARK) >= 0) str = parseRoom(str);
  if(str.indexOf(CHAR_MARK) >= 0) str = parseChar(str);
  if(str.indexOf(ITEM_MARK) >= 0) str = parseItem(str);
  askingLogin = (str.indexOf(LOGIN_MARK) >= 0);
  askingPass = (str.indexOf(PASS_MARK) >= 0);
  
  var lines = str.split('\r\n');
  for(var i=0; i<lines.length; i++) {
    var line = lines[i].replace(/\s\s/g, '&nbsp;');
    if(i < lines.length-1) line += '<br/>';

    // replace the prompt "> " with a empty line
    var len = line.length;
    if(len>=2 && line.substr(len-2) == '> ') line = line.substr(0, line-2);

    line = ansi_up.ansi_to_html(line);

    writeToScreen(line);
  }

  if(askingLogin) {
    setTimeout(function(){
      autologin = localStorage.getItem('autologin');
      if(autologin) autologin = confirm('是否用记住的密码自动登录？');
      if(autologin) {
        var u = localStorage.getItem('username');
        if(sendData && u) sendData(u + '\n');
      }
    }, 100);
  }
  if(askingPass) {
    if(autologin) {
      var p = localStorage.getItem('password');
      if(sendData && p) sendData(p + '\n');
      $('button#explore').click();
    }
  }
}

var exploreCmds = [
  ['看', 'l'],
  ['捡', 'get'],
  ['放', 'put'],
  ['给', 'give'],
  ['丢', 'drop'],
  ['偷', 'steal'],
  ['开门', 'open door'],
  ['关门', 'close door'],
  ['挑战', 'fight'],
  ['杀', 'kill'],
  ['跟随', 'follow'],
  ['组队', 'team'],
  ['状态', 'hp'],
  ['物品', 'i'],
  ['技能', 'skills'],
  ['成就', 'score'],
];

function initKeys(cmds, div, callback) {
  for(var i=0; i<cmds.length; i++) {
    var pair = cmds[i];
    var id = 'exp' + i;
    var txt = pair[0];
    var macro = pair[1];
    $('<button>').text(txt).attr('id', id).attr('macro', macro).addClass('keys').click(callback).appendTo(div);
  }
}

function adjustLayout() {
  var w = $(window).width(), h = $(window).height();

  // adjust input box width
  var w0 = $('div#in').width();
  var btns = ['explore', 'map', 'chat', 'fight'];
  for(var i=0; i<btns.length; i++) {
    w0 -= $('button#'+btns[i]).outerWidth(true)+5;
  }
  $('input#str').css({
    width: w0 + 'px',
  });

  // adjust output area, according to input area height
  var h0 = $('div#in').outerHeight(true);
  $('div#out').css({
    width: (w-22) + 'px',
    height: (h - h0 -32) + 'px',
  });

  scrollDown();
}

function showPad(name) {
  $('div.pad').hide();
  if(name) $('div#'+name).show();
  adjustLayout();
}

function connectServer() {
  // websocket
  var sock = io.connect();
  sock.on('data', function(buf){
    writeServerData(buf);
  });
  sock.on('status', function(str){
    writeToScreen(str);
  });
  sock.on('connected', function(){
    console.log('connected');
  });
  sock.on('disconnect', function(){
    console.log('disconnected');
  });

  // send
  window.sendData = function(str) {
    //writeToScreen(str);
    if(sock) sock.emit('data', str);
  }
}

$(window).resize(adjustLayout);

var cmdHistory = [];
var cmdIndex = 0;

function sendInput() {
  var cmd = $('input#str');
  var str = cmd.val().trim();

  if(askingLogin) localStorage.setItem('username', str);
  else if(askingPass) {
    localStorage.setItem('password', str);
    localStorage.setItem('autologin', confirm('是否记住密码？'));
  }

  // store cmd in history for re-use when press up / down arrow key
  if(cmdHistory.length > 20) cmdHistory.unshift();
  if(str && (str != cmdHistory[cmdHistory.length-1])) {
    cmdHistory.push(str);
  }
  cmdIndex = cmdHistory.length;

  if(sendData) sendData(str + '\n');
  cmd.val('');
}

function onMacroKey(e) {
  var me = $(e.currentTarget);
  var str = me.attr('macro');
  if(sendData) sendData(str + '\n');
}

function initUI() {
  $('button.menu').click(function(e) {
    var name = $(e.currentTarget).attr('id');
    showPad(name);
  });

  $('button.go').click(onMacroKey);

  initKeys(exploreCmds, 'div#expkeys', onMacroKey);

  // UI events
  $('input#str').keydown(function(e) {
    // console.log(e.keyCode);
    switch(e.keyCode) {
      case 38: // up arrow key
        if(cmdIndex > 0) {
          cmdIndex --;
          if(cmdIndex < cmdHistory.length) {
            var str = cmdHistory[cmdIndex];
            $('input#str').val(str);
          }
        } else $('input#str').val('');
        break;
      case 40: // down arrow key
        if(cmdIndex < cmdHistory.length-1) {
          cmdIndex ++;
          var str = cmdHistory[cmdIndex];
          $('input#str').val(str);
        } else $('input#str').val('');
        break;
      case 13: // enter
        sendInput();
        break;
    }
  });
  $('input#str').focus(function(e){
    showPad(null);
  });
}

$(document).ready(function(){
  initUI();

  setTimeout(function(){
    adjustLayout();

    setTimeout(function(){
      connectServer();
    }, 200);
  }, 100)
});