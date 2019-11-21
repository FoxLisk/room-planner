function assert(val, msg) {
    if (!val) {
        alert('assertion error: ' + msg + ' \n (' + val + ')');
    }
}

function RoomPlanner(canvas) {
    var canvas = canvas;
    var ctx = canvas.getContext('2d');
    const CORNER_OFFSET = 10;
    const w = canvas.getAttribute('width');
    const h = canvas.getAttribute('height');
    const DOT_RAD = 1;
    const DOT_SPACING = 13;

    var dots = [];

    // stolen from https://stackoverflow.com/a/33063222
    function get_mouse_pos(evt) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: (evt.clientX - rect.left) / (rect.right - rect.left) * w,
            y: (evt.clientY - rect.top) / (rect.bottom - rect.top) * h,
        };
    }

    function draw_dot(x, y) {
        ctx.moveTo(x, y);
        ctx.arc(x, y, DOT_RAD, 0, 2*Math.PI);
    }


    function draw_dots() {
        const xstart = CORNER_OFFSET + DOT_RAD;
        const xend = w - CORNER_OFFSET - DOT_RAD;
        const ystart = CORNER_OFFSET + DOT_RAD;
        const yend = h - CORNER_OFFSET - DOT_RAD;

        ctx.beginPath();
        dots = [];
        for (var x = xstart; x < xend; x += DOT_SPACING) {
            cur_col = [];
            for (var y = ystart; y < yend; y += DOT_SPACING) {
                draw_dot(x, y)
                cur_col.push(y)
            }
            dots.push({
                x: x,
                ys: cur_col,
            });
        }
        ctx.fillStyle = '#000000';
        ctx.fill();
    }

    function highlight_nearest_dot(event) {
        var pos = get_mouse_pos(event);
        var closest = dots[0];
        for (var i = 0; i < dots.length; i++) {
            if (Math.abs(dots[i].x - pos.x) <= Math.abs(closest.x - pos.x)) {
                closest = dots[i];
            }
        }
        var best_y = closest.ys[0];
        for (var j = 0; j < closest.ys.length; j++) {
            var ytmp = closest.ys[j];
            if (Math.abs(ytmp - pos.y) <= Math.abs(best_y - pos.y)) {
                best_y = ytmp;
            }
        }

        ctx.beginPath();
        ctx.fillStyle = '#FF0000';
        draw_dot(closest.x, best_y);
        ctx.fill();
    }


    this.init = function() {
        draw_dots();
        canvas.addEventListener('click', highlight_nearest_dot);
    }

}

document.addEventListener("DOMContentLoaded", function() {
    var canvas = document.getElementById('planner');
    planner = new RoomPlanner(canvas);
    planner.init();
});
