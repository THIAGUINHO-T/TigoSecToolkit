/**
 * No Windows, comandos instalados via npm global ficam como .cmd
 * Esta função resolve o nome correto do executável por plataforma.
 */
function cmd(name) {
    return process.platform === 'win32' ? `${name}.cmd` : name
}

module.exports = { cmd }
