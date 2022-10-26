import * as vscode from 'vscode';
import * as path from 'path';
import * as pieditor from './editor';
import { BazelTaskProvider } from './bazelTaskProvider';
import { readBazelProject } from './bazelprojectparser';
import { VsCodeWorkspace } from './workspace';
import * as fs from 'fs';

let bazelTaskProvider: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {
	let panel: vscode.WebviewPanel | undefined = undefined;

	console.log('Extension "bazelimport" is now active!');

	let viewTitleDisp = vscode.commands.registerCommand('bazelimport.menus.viewtitle', async () => {
		const columnToShowIn = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;
		if (panel) {
			// If we already have a panel, show it in the target column
			panel.reveal(columnToShowIn);
		} else {
			panel = vscode.window.createWebviewPanel(
				'bazelImportWizard', // Identifies the type of the webview. Used internally
				'Import wizard', // Title of the panel displayed to the user
				vscode.ViewColumn.One, // Editor column to show the new webview panel in.
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: [
						vscode.Uri.file(path.join(context.extensionPath, 'js')),
						vscode.Uri.file(path.join(context.extensionPath, 'css'))
					]
				}
			);

			panel.webview.html = await pieditor.getWebviewContent(panel, context);

			// Handle messages from the webview
			panel.webview.onDidReceiveMessage(
				message => pieditor.handleMessages(context, panel, message),
				undefined,
				context.subscriptions
			);

			panel.onDidDispose(
				() => {
					panel = undefined;
				},
				null,
				context.subscriptions
			);
		}
	});

	context.subscriptions.push(viewTitleDisp);

	bazelTaskProvider = vscode.tasks.registerTaskProvider(BazelTaskProvider.BazelType, new BazelTaskProvider());


	vscode.workspace.findFiles("**/.bazelproject").then(projFile => {
		if(projFile.length){
			// make sure the vscode workspace is in sync with the .bazelproject file on extension activation
			processBazelProjectFile(projFile[0].path);
			fs.watch(projFile[0].path, {}, (event, filename) => {
				console.log(`${filename} was ${event}!`);
				if(event === 'change'){
					processBazelProjectFile(projFile[0].path);
				}
			});
		}
	});

}

// this method is called when your extension is deactivated
export function deactivate() { 
	if (bazelTaskProvider) {
		bazelTaskProvider.dispose(); 
	}
}

async function processBazelProjectFile(bazelProjectPath: string) {
	const bazelProject = readBazelProject(bazelProjectPath);
	const workspaceURI = vscode.workspace.getWorkspaceFolder((await vscode.workspace.findFiles("**/WORKSPACE"))[0]);
	if(vscode.workspace.workspaceFolders && workspaceURI) {
		if(vscode.workspace.workspaceFolders.length > 1){
			const workspaceFolders = bazelProject.directories.concat('.').sort();
			const excludeConfig: ExcludeConfig = {};
			excludeConfig[`**/{${bazelProject.directories.join(',')}}`] = true;
			await vscode.workspace.getConfiguration().update('files.exclude', excludeConfig);
			
			vscode.workspace.updateWorkspaceFolders(
				0,
				vscode.workspace.workspaceFolders.length,
				...workspaceFolders.map(d => {
					const modulePath = vscode.Uri.joinPath(workspaceURI.uri, d);
					return { uri: modulePath };
				})
			);

		} else {
			//TODO: create new vscode workspace based on .bazelproject file and open it.
			console.log('non multi root');

			const codeWorkspaceFile: VsCodeWorkspace = new VsCodeWorkspace(bazelProject.directories.map(d => {return {path: d, selected: true};}));
			codeWorkspaceFile.write(workspaceURI.uri.path);

		}
	}
}

interface ExcludeConfig {
	[key: string]: boolean;
}
