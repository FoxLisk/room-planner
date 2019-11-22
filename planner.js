function assert(val, msg) {
    if (!val) {
        alert('assertion error: ' + msg + ' \n (' + val + ')');
    }
}

function Grid(canvas, corner_offset, dot_radius, dot_spacing) {
    var points = null;
    var dot_radius = dot_radius;

    // TODO: context.scale might be a better way of dealing with this
    var dot_spacing = dot_spacing;
    // N.B. context.translate seems unlikely to be an improvement for the
    // corner offset, since i want an offset on *each* corner.
    var corner_offset = corner_offset;
    const w = canvas.getAttribute('width');
    const h = canvas.getAttribute('height');
    const xstart = corner_offset + dot_radius;
    const xend = w - corner_offset - dot_radius;
    const ystart = corner_offset + dot_radius;
    const yend = w - corner_offset - dot_radius;

    function init() {
        points = [];
        for (var x = xstart; x < xend; x += dot_spacing) {
            cur_row = [];
            for (var y = ystart; y < yend; y += dot_spacing) {
                point = {
                    x: x,
                    y: y,
                    color: '#000000',
                }
                cur_row.push(point)
            }
            points.push(cur_row);
        }
    }

    function draw_dot(ctx, x, y) {
        point = points[x][y]
        // is doing so many beginPath/fills going to be a performance issue?
        // probably but i will worry about it when i get there, maybe
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.arc(point.x, point.y, dot_radius, 0, 2*Math.PI);
        ctx.fillStyle = point.color
        ctx.fill();
    }

    // take x, y as position on canvas, return x, y s.t. points[x][y] is
    // nearest point
    this.find_closest_dot = function(pos) {
        var closest = points[0];
        scaled_x = Math.round((pos.x - corner_offset) / dot_spacing);
        scaled_y = Math.round((pos.y - corner_offset) / dot_spacing);
        return {
            x_coord: scaled_x,
            y_coord: scaled_y,
        }

    }

    this.color_dot = function(dot_coords, color) {
        var dot = points[dot_coords.x_coord][dot_coords.y_coord];
        if (dot.color !== color) {
            dot.color = color;
            dot.dirty = true;
        }
    }

    this.draw = function(ctx) {
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < points.length; i++) {
            for (var j = 0; j < points[i].length; j++) {
                draw_dot(ctx, i, j);
            }
        }
    }

    init();
}

function RoomPlanner(canvas) {
    var canvas = canvas;
    var ctx = canvas.getContext('2d');
    var buttons = document.getElementById('buttons');
    var current_mode = null;
    const mode_span = document.getElementById('current-mode');
    const CORNER_OFFSET = 10;
    const w = canvas.getAttribute('width');
    const h = canvas.getAttribute('height');
    const DOT_RAD = 2;
    const DOT_SPACING = 16;

    var grid = null;

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

    function build_grid() {
        grid = new Grid(canvas, CORNER_OFFSET, DOT_RAD, DOT_SPACING);
    }

    function redraw() {
        grid.draw(ctx);
    }

    function highlight_nearest_dot(event) {
        var pos = get_mouse_pos(event);
        var dot = grid.find_closest_dot(pos);
        grid.color_dot(dot, '#FF0000');
        redraw();
    }

    function set_mode(mode) {
        mode_span.innerHTML = mode;
        current_mode = mode;
    }

    function handle_mode_change(event) {
        if (event.target.dataset.mode) {
            set_mode(event.target.dataset.mode);
        }
    }


    this.init = function() {
        build_grid();
        redraw();
        canvas.addEventListener('click', highlight_nearest_dot);
        buttons.addEventListener('click', handle_mode_change);
        //canvas.addEventListener('onmousedown', 
    }

}

document.addEventListener("DOMContentLoaded", function() {
    var canvas = document.getElementById('planner');
    planner = new RoomPlanner(canvas);
    planner.init();
});
