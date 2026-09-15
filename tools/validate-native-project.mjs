import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const projectRoot = path.join(repoRoot, 'native', 'GridlineRacing');

const requiredFiles = [
  'README.md',
  'Packages/manifest.json',
  'ProjectSettings/ProjectVersion.txt',
  'ProjectSettings/EditorBuildSettings.asset',
  'Assets/Scenes/Bootstrap.unity',
  'Assets/Scenes/Bootstrap.unity.meta',
  'Assets/Gridline/Scripts/Core/GridlineBootstrap.cs',
  'Assets/Gridline/Scripts/Core/GridlineGameState.cs',
  'Assets/Gridline/Scripts/Core/GridlineRuntimeBuilder.cs',
  'Assets/Gridline/Scripts/Vehicle/GridlineVehicleController.cs',
  'Assets/Gridline/Scripts/Camera/GridlineCameraRig.cs',
  'Assets/Gridline/Scripts/UI/GridlineDebugHud.cs',
  'Assets/Gridline/Editor/GridlineBuild.cs',
];

const failures = [];

function fail(message) {
  failures.push(message);
}

function readRelative(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`Missing required file: ${relativePath}`);
    return '';
  }
  return readFileSync(absolutePath, 'utf8');
}

function walkFiles(dir, predicate, output = []) {
  for (const entry of readdirSync(dir)) {
    const absolutePath = path.join(dir, entry);
    const relativePath = path.relative(projectRoot, absolutePath);

    if (/^(Library|Temp|Obj|Build|Builds|Logs|UserSettings)(\/|$)/i.test(relativePath)) {
      continue;
    }

    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      walkFiles(absolutePath, predicate, output);
    } else if (predicate(absolutePath)) {
      output.push(absolutePath);
    }
  }
  return output;
}

for (const file of requiredFiles) {
  readRelative(file);
}

try {
  JSON.parse(readRelative('Packages/manifest.json'));
} catch (error) {
  fail(`Packages/manifest.json is not valid JSON: ${error.message}`);
}

const version = readRelative('ProjectSettings/ProjectVersion.txt');
if (!version.includes('6000.5.1f1')) {
  fail('ProjectVersion.txt does not point at Unity 6000.5.1f1');
}

const buildSettings = readRelative('ProjectSettings/EditorBuildSettings.asset');
if (!buildSettings.includes('Assets/Scenes/Bootstrap.unity')) {
  fail('EditorBuildSettings.asset does not include the bootstrap scene');
}

const scene = readRelative('Assets/Scenes/Bootstrap.unity');
if (!scene.startsWith('%YAML 1.1')) {
  fail('Bootstrap.unity is not a Unity YAML scene file');
}

const csharpFiles = walkFiles(
  path.join(projectRoot, 'Assets', 'Gridline'),
  file => file.endsWith('.cs')
);

for (const absolutePath of csharpFiles) {
  const relativePath = path.relative(projectRoot, absolutePath);
  const source = readFileSync(absolutePath, 'utf8');
  const openBraces = (source.match(/{/g) || []).length;
  const closeBraces = (source.match(/}/g) || []).length;

  if (openBraces !== closeBraces) {
    fail(`${relativePath} has unbalanced braces (${openBraces} open, ${closeBraces} close)`);
  }

  if (!source.includes('namespace Gridline.Native')) {
    fail(`${relativePath} is not in the Gridline.Native namespace`);
  }
}

if (failures.length > 0) {
  console.error('Native project validation failed.');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Native project validation passed (${csharpFiles.length} C# files).`);
