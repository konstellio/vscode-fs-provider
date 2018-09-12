'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { FileSystemProvider } from './FileSystemProvider';
import { copy } from '@konstellio/fs';
import { FileSystemLocal } from '@konstellio/fs-local';
import { basename } from 'path';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const output = vscode.window.createOutputChannel('FS provider');
	
	const provider = new FileSystemProvider(output);
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('ftp', provider, { isCaseSensitive: true }));
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('ftps', provider, { isCaseSensitive: true }));
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('sftp', provider, { isCaseSensitive: true }));

	context.subscriptions.push(vscode.commands.registerCommand('konstelliofs.downloadSelected', async (destination: vscode.Uri, selections: vscode.Uri[]) => {
		const destinations = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Download here'
		});
		if (destinations) {
			for (const selection of selections) {
				await vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: `Downloading ${selection.path}`,
					cancellable: true
				}, async (progress, token) => {
					const remoteFs = await provider.getDriver(selection);
					const src = selection.path;
					const stat = await remoteFs.stat(src);
					const dest = basename(src);
					const localFs = new FileSystemLocal(destinations[0].fsPath);

					const stream = copy(remoteFs, src, localFs, dest);

					token.onCancellationRequested(() => {
						stream.destroy();
					});

					let percentDone = 0;
					let lastPercent = 0;
					let progressMessage = `Gathering list of files and directories for download...`;

					const progressTimer = setInterval(() => {
						const increment = percentDone - lastPercent;
						lastPercent = percentDone;
						progress.report({ increment, message: progressMessage });
					}, 100);

					return new Promise((resolve, reject) => {
						stream.on('error', reject);
						stream.on('end', resolve);
						stream.on('data', entry => {
							percentDone = entry[3] / entry[4] * 100;
							progressMessage = `${entry[1]}`;
							// progress.report({
							// 	increment,
							// 	message: `${entry[0]} => ${entry[1]}`
							// });
							console.log(`${entry[0]} => ${entry[1]}`);
						});
					}).then(() => {
						clearInterval(progressTimer);
					});
				});
			}
		}
	}));

	// context.subscriptions.push(vscode.commands.registerCommand('konstelliofs.downloadSelected', async (destination: vscode.Uri, selections: vscode.Uri[]) => {
	// 	const destinations = await vscode.window.showOpenDialog({
	// 		canSelectFiles: false,
	// 		canSelectFolders: true,
	// 		canSelectMany: false,
	// 		openLabel: 'Download here'
	// 	});
	// 	if (destinations) {
	// 		for (const selection of selections) {
	// 			const remoteFs = await provider.getDriver(selection);
				
	// 			const src = selection.path;
	// 			const stat = await remoteFs.stat(src);
	// 			const dest = stat.isFile ? basename(src) : '';

	// 			const localFs = new FileSystemLocal(destinations[0].fsPath);

	// 			await new Promise((resolve, reject) => {
	// 				const stream = copy(remoteFs, src, localFs, dest);
	// 				stream.on('error', reject);
	// 				stream.on('end', resolve);
	// 				stream.on('data', entry => {
	// 					console.log(`${entry[0]} => ${entry[1]} (${(entry[3] / entry[4] * 100).toFixed(2)})`);
	// 				});
	// 			});

	// 			debugger;
	// 		}
	// 	}
	// }));

	// context.subscriptions.push(vscode.commands.registerCommand('konstelliofs.uploadFilesHere', async (uri: vscode.Uri, selections: vscode.Uri[]) => {
	// 	const sources = await vscode.window.showOpenDialog({
	// 		canSelectFiles: true,
	// 		canSelectFolders: false,
	// 		canSelectMany: true,
	// 		openLabel: 'Upload'
	// 	});
	// 	if (sources) {
	// 		console.log('Upload', sources.map(s => s.fsPath), uri.toString(true));
	// 	}
	// }));

	// context.subscriptions.push(vscode.commands.registerCommand('konstelliofs.uploadFoldersHere', async (uri: vscode.Uri, selections: vscode.Uri[]) => {
	// 	const sources = await vscode.window.showOpenDialog({
	// 		canSelectFiles: false,
	// 		canSelectFolders: true,
	// 		canSelectMany: true,
	// 		openLabel: 'Upload'
	// 	});
	// 	if (sources) {
	// 		console.log('Upload', sources.map(s => s.fsPath), uri.toString(true));
	// 	}
	// }));

	// let NEXT_TERM_ID = 1;
	// context.subscriptions.push(vscode.commands.registerCommand('konstelliofs.createTerminal', () => {
	// 	const terminal = vscode.window.createTerminal(`Ext Terminal #${NEXT_TERM_ID++}`);
	// 	terminal.sendText("echo 'Sent text immediately after creating'");
	// }));

	context.subscriptions.push(vscode.commands.registerCommand('konstelliofs.startTask', () => {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "I am long running!",
			cancellable: true
		}, async (progress, token) => {
			token.onCancellationRequested(() => {
				console.log("User canceled the long running operation")
			});

			progress.report({ increment: 0 });

			// setTimeout(() => {
			// 	progress.report({ increment: 10, message: "I am long running! - still going..." });
			// }, 1000);

			// setTimeout(() => {
			// 	progress.report({ increment: 0, message: "I am long running! - still going even more..." });
			// }, 2000);

			// setTimeout(() => {
			// 	progress.report({ increment: 50, message: "I am long running! - almost there..." });
			// }, 3000);

			let pt = 0.1;
			setInterval(() => {
				progress.report({ increment: pt, message: `I am long running! - almost there... ${pt}` });
			}, 100)

			var p = new Promise(resolve => {
				setTimeout(() => {
					resolve();
				}, 5000);
			});

			return p;
		});
	}));
}

// this method is called when your extension is deactivated
export function deactivate() {
}