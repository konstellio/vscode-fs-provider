'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { FileSystemProvider } from './FileSystemProvider';
import { copy, FileSystem } from '@konstellio/fs';
import { FileSystemLocal } from '@konstellio/fs-local';
import { basename, dirname, join, sep } from 'path';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const output = vscode.window.createOutputChannel('FS provider');
	
	const provider = new FileSystemProvider(output);
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('ftp', provider, { isCaseSensitive: true }));
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('ftps', provider, { isCaseSensitive: true }));
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('sftp', provider, { isCaseSensitive: true }));

	const byteUnits = ['bps', 'kbps', 'mbps', 'gbps', 'tbps'];

	async function copyResource(fsSource: FileSystem, source: string, fsDestination: FileSystem, destination: string, title: string) {
		await vscode.window.withProgress({
			title,
			location: vscode.ProgressLocation.Notification,
			cancellable: true,
		}, async (progress, token) => {
			const stream = copy(fsSource, source, fsDestination, destination);

			token.onCancellationRequested(() => {
				stream.destroy();
			});

			let totalBytes = 0;
			let bytesTransfered = 0;
			let lastBytesTransfered = 0;
			let lastFile = '';
			let lastProgressTime = Date.now() / 1000;

			progress.report({ increment: 0, message: `Calculating size...` });

			const progressTimer = setInterval(() => {
				if (bytesTransfered <= lastBytesTransfered) {
					return;
				}

				const percent = bytesTransfered / totalBytes * 100;
				const percentDelta = percent - (lastBytesTransfered / totalBytes * 100);
				const now = Date.now() / 1000;
				// const expectedTime = now * totalBytes / bytesTransfered;
				const timeDelta = now - lastProgressTime;
				const bytesDelta = bytesTransfered - lastBytesTransfered;

				const bps = bytesDelta / timeDelta;
				const bpsPow = Math.min(Math.floor((bps ? Math.log(bps) : 0) / Math.log(1024)), byteUnits.length - 1);
				const bpsUnit = byteUnits[bpsPow];

				const speed = `${(bps / Math.pow(1024, bpsPow)).toFixed(2)}${bpsUnit}`;

				progress.report({
					increment: percentDelta,
					message: `${speed} | ${lastFile}`
				});

				lastBytesTransfered = bytesTransfered;
				lastProgressTime = now;
			}, 300);

			return new Promise((resolve, reject) => {
				stream.on('error', reject);
				stream.on('end', resolve);
				stream.on('data', entry => {
					totalBytes = entry[4];
					bytesTransfered = entry[3];
					lastFile = entry[0];
				});
			}).catch().then(() => {
				clearInterval(progressTimer);
			});
		});
	}

	context.subscriptions.push(vscode.commands.registerCommand('konstelliofs.downloadSelected', async (destination: vscode.Uri, selections: vscode.Uri[]) => {
		const destinations = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Download here'
		});
		if (destinations) {
			for (const selection of selections) {
				const fsSrc = await provider.getDriver(selection);
				const fsDst = new FileSystemLocal(destinations[0].fsPath);
				const src = selection.path;
				const dst = basename(src);
				await copyResource(fsSrc, src, fsDst, dst, `Downloading`);
			}
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('konstelliofs.uploadFoldersHere', async (destination: vscode.Uri, selections: vscode.Uri[]) => {
		const sources = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: true,
			openLabel: 'Upload'
		});
		if (sources) {
			for (const source of sources) {
				const fsSrc = new FileSystemLocal(dirname(source.fsPath));
				const fsDst = await provider.getDriver(destination);
				const src = basename(source.fsPath);
				const dst = join(destination.path, src).split(sep).join('/');
				await copyResource(fsSrc, src, fsDst, dst, `Uploading`);
			}
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('konstelliofs.uploadFilesHere', async (destination: vscode.Uri, selections: vscode.Uri[]) => {
		const sources = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: true,
			openLabel: 'Upload'
		});
		if (sources) {
			for (const source of sources) {
				const fsSrc = new FileSystemLocal(dirname(source.fsPath));
				const fsDst = await provider.getDriver(destination);
				const src = basename(source.fsPath);
				const dst = join(destination.path, src).split(sep).join('/');
				await copyResource(fsSrc, src, fsDst, dst, `Uploading`);
			}
		}
	}));

	// let NEXT_TERM_ID = 1;
	// context.subscriptions.push(vscode.commands.registerCommand('konstelliofs.createTerminal', () => {
	// 	const terminal = vscode.window.createTerminal(`Ext Terminal #${NEXT_TERM_ID++}`);
	// 	terminal.sendText("echo 'Sent text immediately after creating'");
	// }));
}

// this method is called when your extension is deactivated
export function deactivate() {
}