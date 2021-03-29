const pack = require('./src/pack');
let i = 2;
let packPath = "";
while (i < process.argv.length) {
    var arg = process.argv[i];
    switch (arg) {
        case '--path':
        case '-p':
            packPath = process.argv[i + 1];
            i += 2;
            break;
        default:
            i++;
            break;
    }
}
pack.init(packPath, __dirname);