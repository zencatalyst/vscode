/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { streamToBuffer } from 'vs/base/common/buffer';
import { Schemas } from 'vs/base/common/network';
import { ServicesAccessor } from 'vs/editor/browser/editorExtensions';
import { localize } from 'vs/nls';
import { registerAction2, Action2 } from 'vs/platform/actions/common/actions';
import { IFileService } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { INotebookService, SimpleNotebookProviderInfo } from 'vs/workbench/contrib/notebook/common/notebookService';
import { NotebookData } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { IFileQuery, ISearchService, QueryType } from 'vs/workbench/services/search/common/search';
import { CancellationToken } from 'vs/base/common/cancellation';

registerAction2(class NotebookDeserializeTest extends Action2 {

	constructor(
	) {
		super({
			id: 'NotebookDeserializeTest',
			title: {
				value: localize('notebookDeserializeTest', 'Test Deserialize Perf'),
				original: 'Test Deserialize Perf'
			},
			f1: true
		});
	}
	async run(accessor: ServicesAccessor) {
		const fileService = accessor.get(IFileService);
		const notebookService = accessor.get(INotebookService);
		const workspacesService = accessor.get(IWorkspaceContextService);
		const logService = accessor.get(ILogService);
		const searchService = accessor.get(ISearchService);

		const currWorkspace = workspacesService.getWorkspace();
		const uri = currWorkspace.folders[0].uri;


		// const queryBuilder = instantiationService.createInstance(QueryBuilder);

		// const query = queryBuilder.text(content, folderResources.map(folder => folder.uri))
		const query: IFileQuery = {
			type: QueryType.File,
			filePattern: '**/*.ipynb',
			folderQueries: [{ folder: uri }]
		};
		const searchComplete = await searchService.fileSearch(
			query,
			CancellationToken.None
		);
		// glob(dir + '/**/*.ipynb', {}, async (err, files) => {
		logService.info('notebook deserialize START');
		let processedFiles = 0;
		let processedBytes = 0;
		let processedCells = 0;
		const start = Date.now();
		for (const fileMatch of searchComplete.results) {
			const uri = fileMatch.resource;
			const content = await fileService.readFileStream(uri);
			try {
				const info = await notebookService.withNotebookDataProvider('jupyter-notebook');
				if (!(info instanceof SimpleNotebookProviderInfo)) {
					throw new Error('CANNOT open file notebook with this provider');
				}

				let _data: NotebookData = {
					metadata: {},
					cells: []
				};
				if (uri.scheme !== Schemas.vscodeInteractive) {
					const bytes = await streamToBuffer(content.value);
					processedBytes += bytes.byteLength;
					_data = await info.serializer.dataToNotebook(bytes);
				}

				processedFiles += 1;
				processedCells += _data.cells.length;
			} catch (e) {
				logService.info('error: ' + e);
				continue;
			}
		}
		const end = Date.now();
		logService.info(`notebook deserialize END | ${end - start}ms | ${((processedBytes / 1024) / 1024).toFixed(2)}MB | Number of Files: ${processedFiles} | Number of Cells: ${processedCells}`);
		// });
	}
});
