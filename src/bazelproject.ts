import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { BazelModule, BazelModuleQuickPickItem } from './bazelmodule';
import { readBazelProject } from './bazelprojectparser';
import { VsCodeWorkspace } from './workspace';

export class BazelProject {
    private readonly codeWorkspaceExt: string = '.code-workspace';
    private readonly codeWorkspaceFile: string = 'workspace' + this.codeWorkspaceExt;

    private _sourceWorkspace: string;
    private _sourceFolder: string;
    private _intellijProjectFolder: string;
    private _targetFolder: string;

    constructor(src: string, trg: string) {
        this._sourceWorkspace = src;
        this._targetFolder = trg;
        this._sourceFolder = path.dirname(this._sourceWorkspace);
        this._intellijProjectFolder = path.join(this.sourceFolder, '.ijwb');
    }

    public get sourceWorkspace(): string {
        return this._sourceWorkspace;
    }

    public get sourceFolder(): string {
        return this._sourceFolder;
    }

    public get intellijProjectFolder(): string {
        return this._intellijProjectFolder;
    }

    public get targetFolder(): string {
        return this._targetFolder;
    }

    public openProject(modules: BazelModule[]) {
        this.buildBazelProject(modules, this._intellijProjectFolder);
        this.buildCodeWorkspace(modules, this._sourceFolder);
        this.openFolder(path.join(this._sourceFolder, this.codeWorkspaceFile));
    }

    public lookupModules(): BazelModule[] {
        let modules: BazelModule[] = [];
        if (fs.existsSync(this._sourceFolder)) {
            const bazelProject = readBazelProject(path.join(this._intellijProjectFolder, '.bazelproject'));
            const preselectedModules: string[] = bazelProject.directories;

            const topmodules: BazelModule[] = this.readfolders(undefined);
            topmodules.forEach((current) => {
                const isBuild: boolean = this.buildHierarchy(current, preselectedModules);
                if (true === isBuild) {
                    modules.push(current);
                }
            });
        }
        return modules;
    }

    private buildCodeWorkspace(modules: BazelModule[], folder: string,) {
        const codeWorkspaceFile: VsCodeWorkspace = new VsCodeWorkspace(modules);
        codeWorkspaceFile.write(folder);
    }

    private buildBazelProject(modules: BazelModule[], folder: string) {
        const bazelprojectFile = path.join(folder, '.bazelproject');
        if (modules && modules.length > 0) {
            if(!fs.existsSync(folder)){
                fs.mkdirSync(folder, {recursive: true});
            }
            if (fs.existsSync(bazelprojectFile)) {
                fs.renameSync(bazelprojectFile, bazelprojectFile + '.' + Date.now());
            }
            let fileContent = 'directories:' + os.EOL;
            modules
                .filter((module) => true === module.selected)
                .forEach((module) => {
                    const path: string = module.path;
                    fileContent = fileContent + '  ' + path + os.EOL;
                });
            fs.writeFileSync(bazelprojectFile, fileContent);
        } else if (fs.existsSync(bazelprojectFile)) {
            fs.unlinkSync(bazelprojectFile);
        }
    }

    private openFolder(folder: string) {
        const uri: vscode.Uri = vscode.Uri.file(folder);
        vscode.commands.executeCommand('vscode.openFolder', uri);
    }

    private makeTargetFolder() {
        const targetPath = path.resolve(this._targetFolder);
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath);
        }
    }

    private buildSymlinks(modules: string[]) {
        if (modules && modules.length > 0) {
            modules.forEach((sourceModule) => {
                const moduleName: string = path.basename(sourceModule);
                const targetModulePath = path.join(this._targetFolder, moduleName);
                const sourceModulePath = path.join(this._sourceFolder, moduleName);
                fs.symlinkSync(sourceModulePath, targetModulePath);
            });
            const targetWorkspaceFile = path.join(this._targetFolder, 'WORKSPACE');
            fs.symlinkSync(this._sourceWorkspace, targetWorkspaceFile);
        }
    }

    private buildHierarchy(parent: BazelModule, preselected: string[]): boolean {
        let isBuild = false;

        if (fs.existsSync(path.join(this.sourceFolder, parent.path, 'BUILD'))) {
            isBuild = true;
        } else if (fs.existsSync(path.join(this.sourceFolder, parent.path, 'BUILD.bazel'))) {
            isBuild = true;
        }

        const selected = preselected.find((name) => name === parent.path);
        if (selected) {
            isBuild = true;
            parent.selected = true;
        }

        const nested: BazelModule[] = this.readfolders(parent);
        if (nested) {
            nested.forEach(module => {
                const buildModule: boolean = this.buildHierarchy(module, preselected);
                if (buildModule) {
                    if(!parent.nested){
                        parent.nested = [];
                    }
                    parent.nested.push(module);
                    isBuild = true;
                }
            });
        }
        return isBuild;
    }

    private readfolders(base: BazelModule | undefined): BazelModule[] {
        let absolutePath: string = (base ? path.join(this.sourceFolder, base.path) : this.sourceFolder);
        const nested: BazelModule[] = fs.readdirSync(absolutePath, { withFileTypes: true }).//
            filter(file => ((!file.name.startsWith('.')) && (!file.name.startsWith('src')) && file.isDirectory())).//
            map(file => {
                return {
                    name: file.name,
                    selected: false,
                    path: base ? path.join(base.path, file.name) : file.name
                };
            });
        return nested;
    }
}

export async function importBazelProject(bazelWorkspaceFiles: vscode.Uri[]) {
	const bi = new BazelProject(bazelWorkspaceFiles[0].fsPath, '');
	const modules = bi.lookupModules();
	if (modules.length === 0) {
		await vscode.window.showInformationMessage('No modules found in this workspace');
		return;
	}

	const quickPickItems = createBazelModuleQuickPickItems(modules);
	const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
		title: 'Bazel Modules',
		placeHolder: 'Pick modules to import',
		canPickMany: true,
	});
	if (selectedItems === undefined || selectedItems.length === 0) {
		return;
	}

	const selectedModules = selectedItems.map(item => {
		item.module.selected = true;
		return item.module;
	});
	bi.openProject(selectedModules);
}

function createBazelModuleQuickPickItems(modules: BazelModule[]): BazelModuleQuickPickItem[] {
	const result: BazelModuleQuickPickItem[] = [];
	for (const module of modules) {
		result.push(new BazelModuleQuickPickItem(module));
		if (module.nested) {
			const nestedModules = createBazelModuleQuickPickItems(module.nested);
			result.push(...nestedModules);
		}
	}
	return result;
}