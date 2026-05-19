/**
 * Detecta o tipo de projeto em um diretório.
 * Retorna um objeto com os frameworks/tecnologias encontrados.
 */
const fs = require('fs')
const path = require('path')

function detectProject(dir) {
    const result = {
        hasPackageJson: false,
        frameworks: [],
        language: [],
        hasGit: false,
        hasPrisma: false,
        hasDocker: false,
        packageJson: null,
    }

    // Git
    result.hasGit = fs.existsSync(path.join(dir, '.git'))

    // Docker
    result.hasDocker = fs.existsSync(path.join(dir, 'Dockerfile')) || fs.existsSync(path.join(dir, 'docker-compose.yml'))

    // Prisma
    result.hasPrisma = fs.existsSync(path.join(dir, 'prisma'))

    // package.json
    const pkgPath = path.join(dir, 'package.json')
    if (fs.existsSync(pkgPath)) {
        result.hasPackageJson = true
        try {
            result.packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
            const deps = {
                ...result.packageJson.dependencies,
                ...result.packageJson.devDependencies,
            }

            if (deps['next']) result.frameworks.push('Next.js')
            if (deps['react']) result.frameworks.push('React')
            if (deps['vue']) result.frameworks.push('Vue')
            if (deps['@angular/core']) result.frameworks.push('Angular')
            if (deps['express']) result.frameworks.push('Express')
            if (deps['fastify']) result.frameworks.push('Fastify')
            if (deps['nestjs'] || deps['@nestjs/core']) result.frameworks.push('NestJS')
            if (deps['prisma'] || deps['@prisma/client']) result.frameworks.push('Prisma')
            if (deps['mercadopago']) result.frameworks.push('MercadoPago')
            if (deps['next-auth']) result.frameworks.push('NextAuth')
            if (deps['typescript']) result.language.push('TypeScript')

            result.language.push('JavaScript/Node.js')
        } catch {}
    }

    // Python
    if (fs.existsSync(path.join(dir, 'requirements.txt')) || fs.existsSync(path.join(dir, 'pyproject.toml'))) {
        result.language.push('Python')
        if (fs.existsSync(path.join(dir, 'manage.py'))) result.frameworks.push('Django')
        if (fs.existsSync(path.join(dir, 'app.py'))) result.frameworks.push('Flask/FastAPI')
    }

    // PHP
    if (fs.existsSync(path.join(dir, 'composer.json'))) {
        result.language.push('PHP')
        try {
            const composer = JSON.parse(fs.readFileSync(path.join(dir, 'composer.json'), 'utf8'))
            const req = composer.require || {}
            if (req['laravel/framework']) result.frameworks.push('Laravel')
            if (req['symfony/symfony']) result.frameworks.push('Symfony')
        } catch {}
    }

    // .NET
    const csproj = fs.readdirSync(dir).find(f => f.endsWith('.csproj') || f.endsWith('.sln'))
    if (csproj) result.language.push('.NET/C#')

    return result
}

module.exports = { detectProject }
