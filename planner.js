const CORNER_OFFSET = 10;
var w, h;

function draw_dots(ctx) {
    const RAD = 1;
    const SPACING = 13;
    const xstart = CORNER_OFFSET + RAD;
    const xend = w - CORNER_OFFSET - RAD;
    const ystart = CORNER_OFFSET + RAD;
    const yend = h - CORNER_OFFSET - RAD;

    for (var x = xstart; x < xend; x += SPACING) {
        for (var y = ystart; y < yend; y += SPACING) {
            ctx.moveTo(x, y);
            ctx.arc(x, y, RAD, 0, 2*Math.PI);
            console.log(x, y);
        }
    }
    ctx.fill();

}

document.addEventListener("DOMContentLoaded", function() {
    console.log('draw dots');
    var canvas = document.getElementById('planner');
    w = canvas.getAttribute('width');
    h = canvas.getAttribute('height');

    var ctx = canvas.getContext('2d');
    //ctx.beginPath();
    //ctx.moveTo(CORNER_OFFSET, CORNER_OFFSET);
    console.log('draw dots');
    draw_dots(ctx);
    console.log('done');
    ctx.lineWidth = 4;
});
