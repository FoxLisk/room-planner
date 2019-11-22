"use strict";

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
            var cur_row = [];
            for (var y = ystart; y < yend; y += dot_spacing) {
                cur_row.push({
                    x: x,
                    y: y,
                    color: '#000000',
                });
            }
            points.push(cur_row);
        }
    }

    function draw_dot(ctx, x, y) {
        var point = points[x][y]
        // is doing so many beginPath/fills going to be a performance issue?
        // probably but i will worry about it when i get there, maybe
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.arc(point.x, point.y, dot_radius, 0, 2*Math.PI);
        ctx.fillStyle = point.color
        ctx.fill();
    }

    this.canvas_coords = function(dot) {
        var point = points[dot.x_coord][dot.y_coord];
        return {
            x: point.x,
            y: point.y,
        };
    }

    // take x, y as position on canvas, return x, y s.t. points[x][y] is
    // nearest point
    this.find_closest_dot = function(pos) {
        var closest = points[0];
        var scaled_x = Math.round((pos.x - corner_offset) / dot_spacing);
        var scaled_y = Math.round((pos.y - corner_offset) / dot_spacing);
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
    const mode_span = document.getElementById('current-mode');
    const CORNER_OFFSET = 10;
    const w = canvas.getAttribute('width');
    const h = canvas.getAttribute('height');
    const DOT_RAD = 2;
    const DOT_SPACING = 16;

    var grid = null;

    var current_mode = null;
    var state = {
    };

    var walls = [];

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

    function draw_walls() {
        for (var i = 0; i < walls.length; i++) {
            console.log('drawing ', walls[i]);
            draw_wall(walls[i].start, walls[i].end);
        }
    }

    function redraw() {
        ctx.clearRect(0, 0, w, h);
        grid.draw(ctx);
        draw_walls();
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

    function draw_wall(start, end) {
        var dx = Math.abs(end.x_coord - start.x_coord);
        var dy = Math.abs(end.y_coord - start.y_coord);
        var true_end = {
            x_coord: end.x_coord,
            y_coord: end.y_coord,
        }
        if (dx < dy) {
            true_end.x_coord = start.x_coord;
        } else {
            true_end.y_coord = start.y_coord;
        }
        var start_coords = grid.canvas_coords(start);
        var end_coords = grid.canvas_coords(true_end);

        ctx.beginPath();
        ctx.moveTo(start_coords.x, start_coords.y);
        ctx.lineTo(end_coords.x, end_coords.y);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#00FF00';
        ctx.stroke();

        return {
            start: Object.assign({}, start),
            end: Object.assign({}, true_end),
        };

    }

    function reinit_wall_state() {
        state.walls = {
            mode: 'start',
            start_dot: null,
        }
    }

    function handle_walls_mousedown(event) {
        if (state.walls.mode !== 'start') {
            alert('bad wall state');
        }
        var pos = get_mouse_pos(event);
        var dot = grid.find_closest_dot(pos);
        state.walls = {
            mode: 'drawing',
            start_dot: dot,
        }
    }

    function handle_walls_mousemove(event) {
        if (state.walls.mode !== 'drawing') {
            // only wanna do this shit while the mouse is down
            return;
        }
        console.log('mousemove');
        var pos = get_mouse_pos(event);
        var end = grid.find_closest_dot(pos);
        redraw();
        draw_wall(state.walls.start_dot, end);
        console.log('end mousemove');
    }

    function handle_walls_mouseup(event) {
        if (state.walls.mode !== 'drawing') {
            alert('bad wall state');
        }
        var pos = get_mouse_pos(event);
        var end = grid.find_closest_dot(pos);
        var wall = draw_wall(state.walls.start_dot, end);
        walls.push(wall);
        reinit_wall_state();
    }

    function handle_mousedown(event) {
        if (current_mode === 'walls') {
            handle_walls_mousedown(event);
        }
    }

    function handle_mousemove(event) {
        if (current_mode === 'walls') {
            handle_walls_mousemove(event);
        }
    }

    function handle_mouseup(event) {
        if (current_mode === 'walls') {
            handle_walls_mouseup(event);
        }
    }


    this.init = function() {
        reinit_wall_state();
        build_grid();
        redraw();
        //canvas.addEventListener('click', highlight_nearest_dot);
        buttons.addEventListener('click', handle_mode_change);
        canvas.addEventListener('mousedown', handle_mousedown);
        canvas.addEventListener('mousemove', handle_mousemove);
        canvas.addEventListener('mouseup', handle_mouseup);
    }

}

document.addEventListener("DOMContentLoaded", function() {
    var canvas = document.getElementById('planner');
    planner = new RoomPlanner(canvas);
    planner.init();
});
