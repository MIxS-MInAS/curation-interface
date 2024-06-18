$(document).ready(function () {
    const proxyUrl = 'https://api.allorigins.win/get?url=';
    const hostUrl = 'https://minas.paleogenomics.eu/minas_host.json';
    const sedimentUrl = 'https://minas.paleogenomics.eu/minas_sed.json';
    const editedRows = new Set();
    const modifiedData = {};
    const newRows = new Set();
    const columnOrder = [
        'Comments',
        'Item',
        'Package',
        'Section',
        'Requirement level',
        'Occurrence',
        'Definition',
        'Example',
        'Expected value',
        'Preferred unit',
        'Value syntax',
        'Structured comment name',
        'MIXS ID'
    ];
    let submissionTitle = '';
    let tableInstances = {};
    let isDevelopment = $('#editSwitch').is(':checked');
    let activeTable = null;
    let currentPackage = '';

    $('#mimsHost').click(function () {
        loadTableData(hostUrl, 'MimsHostAssociated + Ancient');
        submissionTitle = 'MimsHostAssociated_Ancient';
    });

    $('#sedimentMims').click(function () {
        loadTableData(sedimentUrl, 'SedimentMIMS + Ancient');
        submissionTitle = 'SedimentMIMS_Ancient';
    });

    function loadTableData(url, title) {
        console.debug("Loading table data...");
        $('#loadingMessage').show();
        $('#dataset-selection').hide();
        $('#table-container').hide();

        $.get(proxyUrl + encodeURIComponent(url), function (response) {
            const data = JSON.parse(response.contents);
            populateTables(data, title);
            $('#loadingMessage').hide();
            $('#table-title').text(title);
            $('#table-container').show();
            $('#tableTabs a:first').tab('show').trigger('shown.bs.tab');
            console.debug("Table data loaded successfully.");
        }).fail(function () {
            showModal('Failed to load data from the specified URL.');
        });
    }

    function populateTables(data, title) {
        console.debug("Populating tables...");
        const tableTabs = $('#tableTabs');
        const tableTabsContent = $('#tableTabsContent');
        const packageSelect = $('#packageSelect');
        tableTabs.empty();
        tableTabsContent.empty();
        packageSelect.empty();

        const packages = [...new Set(data.map(row => row.Package))];

        packages.forEach((packageName, index) => {
            const packageData = data.filter(row => row.Package === packageName);
            const tableId = `table-${packageName.replace(/\s+/g, '-')}`;
            const isActive = index === 0 ? 'active' : '';
            const tabHtml = `
                <li class="nav-item">
                    <a class="nav-link ${isActive}" id="${tableId}-tab" data-bs-toggle="tab" href="#${tableId}" role="tab" aria-controls="${tableId}" aria-selected="${isActive === 'active'}">${packageName}</a>
                </li>`;
            tableTabs.append(tabHtml);

            const tabContentHtml = `
                <div class="tab-pane fade show ${isActive}" id="${tableId}" role="tabpanel" aria-labelledby="${tableId}-tab">
                    <table class="table table-striped table-bordered" id="${tableId}-table" style="width:100%">
                        <thead>
                            <tr class="header">
                                <th class="select-checkbox sorting_disabled" aria-label="" rowspan="1" colspan="1" style="width: 3px;"></th> <!-- Checkbox column -->
                                <!-- Table headers will be populated here -->
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Data rows will be populated here -->
                        </tbody>
                        <tfoot>
                            <tr>
                                <th class="select-checkbox sorting_disabled" aria-label="" rowspan="1" colspan="1" style="width: 3px;"></th> <!-- Checkbox column -->
                                <!-- Filter inputs will be populated here -->
                            </tr>
                        </tfoot>
                    </table>
                </div>`;
            tableTabsContent.append(tabContentHtml);
            packageSelect.append(new Option(packageName, packageName));
            const tableElement = $(`#${tableId}-table`);
            populateTable(tableElement, packageData, packageName);
        });

        initializeDataTable();
    }

    function populateTable(tableElement, data, packageName) {
        console.debug("Populating table: ", packageName);
        const thead = tableElement.find('thead tr.header');
        thead.empty();
        thead.append('<th class="select-checkbox sorting_disabled" aria-label="" rowspan="1" colspan="1" style="width: 3px;"></th>'); // Add checkbox column
        columnOrder.forEach(function (col) {
            thead.append('<th>' + col + '</th>');
        });

        // Add a hidden column for unique row identifiers
        thead.append('<th class="d-none">RowID</th>');

        const tfoot = tableElement.find('tfoot tr');
        tfoot.empty();
        tfoot.append('<th class="select-checkbox sorting_disabled" aria-label="" rowspan="1" colspan="1" style="width: 3px;"></th>'); // Add checkbox column
        columnOrder.forEach(function (col) {
            tfoot.append('<th><input type="text" placeholder="Search ' + col + '" /></th>');
        });

        // Add a hidden column for unique row identifiers
        tfoot.append('<th class="d-none"><input type="text" placeholder="Search RowID" /></th>');

        const tbody = tableElement.find('tbody');
        tbody.empty();
        data.forEach(function (row, rowIndex) {
            const uniqueId = `${packageName}-${rowIndex}`; // Unique identifier for each row
            const tr = $('<tr>').attr('data-unique-id', uniqueId);
            tr.append('<td class="select-checkbox sorting_disabled" aria-label="" rowspan="1" colspan="1" style="width: 3px;"><input type="checkbox" class="row-select"></td>'); // Add checkbox column
            columnOrder.forEach(function (col) {
                const cellValue = row[col] || '';
                const td = $('<td>')
                    .attr('contenteditable', col === 'Comments' || isDevelopment)
                    .attr('data-original-value', cellValue)
                    .attr('title', cellValue) // Tooltip
                    .text(cellValue);
                tr.append(td);
            });
            // Add the unique identifier to the row
            tr.append('<td class="d-none row-id">' + uniqueId + '</td>');
            tbody.append(tr);
        });

        // Initialize DataTable after the table is populated
        const dataTable = tableElement.DataTable({
            scrollY: 'calc(50vh - 100px)',
            paging: true,
            autoWidth: true,
            scrollX: true,
            scrollCollapse: true,
            colReorder: {
                fixedColumnsLeft: 2, // Prevent reordering of the first two columns
                reorderable: true,
                columns: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] // List of columns that can be reordered (excluding 'Comments' and 'Item')
            },
            fixedColumns: {
                leftColumns: 2 // Fix the first two columns (Comments and Item)
            },
            columnDefs: [
                { targets: 14, visible: false } // Hide the unique identifier column
            ],
            initComplete: function (settings, json) {
                const api = this.api();
                setDynamicMaxWidth(tableElement, api);
                api.columns.adjust().draw();
            }
        });

        tableInstances[packageName] = dataTable;

        // Enable Bootstrap tooltips
        $('[data-toggle="tooltip"]').tooltip();

        // Add search functionality to footer inputs
        dataTable.columns().every(function () {
            var that = this;

            $('input', this.footer()).on('keyup change clear', function () {
                if (that.search() !== this.value) {
                    that.search(this.value).draw();
                }
            });
        });

        // Add event listener for contenteditable cells
        tableElement.on('focusout', 'td[contenteditable="true"]', function () {
            const $cell = $(this);
            const newValue = $cell.text();
            const uniqueId = $cell.closest('tr').attr('data-unique-id');
            const colName = columnOrder[$cell.index() - 1]; // Adjust index as needed
            updateCellValue($cell, newValue, uniqueId, colName);
        });

        // Add row selection for deletion via checkbox
        tableElement.on('click', '.row-select', function (e) {
            const row = $(this).closest('tr');
            row.toggleClass('selected', $(this).is(':checked'));
        });

        $('#delete-row').click(function () {
            const selectedRows = $('.tab-pane.active table tbody tr.selected');
            console.debug("Number of selected rows: ", selectedRows.length); // Debug statement

            if (selectedRows.length === 0) {
                showModal('No rows selected for deletion.');
                return;
            }
            $('#deleteConfirmModal').modal('show');
        });

        $('#confirmDeleteRow').click(function () {
            const selectedRows = tableElement.find('tr.selected');
            console.debug("Number of selected rows: ", selectedRows.length); // Debug statement

            selectedRows.each(function () {
                const uniqueId = $(this).attr('data-unique-id');
                console.debug("Unique ID of the selected row: ", uniqueId); // Debug statement

                delete modifiedData[uniqueId];
                newRows.delete(uniqueId);
            });
            dataTable.rows('.selected').remove().draw();
            $('#deleteConfirmModal').modal('hide');
        });

        $('#view-row').click(function () {
            const selectedRows = $('.tab-pane.active table tbody tr.selected');
            console.debug("Number of selected rows: ", selectedRows.length); // Debug statement

            if (selectedRows.length !== 1) {
                showModal('Please select exactly one row to view.');
                return; // Exit the function to prevent showing the modal
            }

            const row = selectedRows.eq(0);
            const uniqueId = row.attr('data-unique-id');
            console.debug("Unique ID of the selected row: ", uniqueId); // Debug statement
            const rowData = getRowData(row, uniqueId);

            $('#viewRowForm').empty();
            columnOrder.forEach((col) => {
                const value = rowData[col];
                const formGroup = `<div class="form-group">
                    <label for="view-${col.replace(/\s+/g, '-')}" class="col-form-label">${col}:</label>
                    <textarea class="form-control" id="view-${col.replace(/\s+/g, '-')}" readonly>${value}</textarea>
                </div>`;
                $('#viewRowForm').append(formGroup);
            });

            $('#viewRowModal').modal('show');
        });

        $('#edit-row').click(function () {
            const selectedRows = $('.tab-pane.active table tbody tr.selected');
            if (selectedRows.length !== 1) {
                showModal('Please select exactly one row to edit.');
                return;
            }
            const row = selectedRows.eq(0);
            const uniqueId = row.attr('data-unique-id');
            const rowData = getRowData(row, uniqueId);

            $('#editRowForm').empty();
            columnOrder.forEach((col, index) => {
                const value = rowData[col];
                const formGroup = `<div class="form-group">
                    <label for="edit-${col.replace(/\s+/g, '-')}" class="col-form-label">${col}:</label>
                    <textarea class="form-control" id="edit-${col.replace(/\s+/g, '-')}" style="min-height: 40px;">${value}</textarea>
                </div>`;
                $('#editRowForm').append(formGroup);
            });

            $('#editRowModal').modal('show');
        });

        $('#saveEditRow').click(function () {
            const selectedRows = $('.tab-pane.active table tbody tr.selected');
            if (selectedRows.length !== 1) {
                showModal('Please select exactly one row to edit.');
                return;
            }
            const row = selectedRows.eq(0);
            const uniqueId = row.attr('data-unique-id');

            columnOrder.forEach((col, index) => {
                const newValue = $(`#edit-${col.replace(/\s+/g, '-')}`).val();
                const cell = row.find(`td:eq(${index + 1})`);
                cell.text(newValue).attr('data-original-value', newValue);

                // Update modifiedData object
                if (!modifiedData[uniqueId]) {
                    modifiedData[uniqueId] = {};
                    // Store original values for the entire row
                    columnOrder.forEach(function (col) {
                        const originalValue = row.find(`td:eq(${columnOrder.indexOf(col) + 1})`).attr('data-original-value') || '';
                        modifiedData[uniqueId][col] = {
                            original: originalValue,
                            modified: originalValue
                        };
                    });
                }

                // Update the modified value if it is different from the original
                if (modifiedData[uniqueId][col].original !== newValue) {
                    modifiedData[uniqueId][col].modified = newValue;
                } else {
                    modifiedData[uniqueId][col].modified = '';
                }

                // Apply modified class
                if (modifiedData[uniqueId][col].original !== newValue) {
                    cell.addClass('modified-cell');
                    row.addClass('modified-row');
                } else {
                    cell.removeClass('modified-cell');
                    if (row.find('.modified-cell').length === 0) {
                        row.removeClass('modified-row');
                    }
                }
            });

            const activeTableId = $('.tab-pane.active table').attr('id');
            const dataTable = $(`#${activeTableId}`).DataTable();
            dataTable.row(row).invalidate().draw(); // Redraw the table to reflect changes
            $('#editRowModal').modal('hide');
        });
    }

    function setDynamicMaxWidth(tableElement, dataTable) {
        dataTable.columns().every(function () {
            const colIdx = this.index();
            const colWidth = $(this.header()).outerWidth();
            tableElement.find('tbody td:nth-child(' + (colIdx + 1) + ')').css('max-width', colWidth + 'px');
        });

        tableElement.find('tbody td[contenteditable="true"]').on('input', function () {
            const $this = $(this);
            const maxWidth = $this.css('max-width');
            $this.css('width', 'auto');
            if ($this.width() > parseInt(maxWidth)) {
                $this.css('width', maxWidth);
            }
        });
    }

    function initializeDataTable() {
        $('#tableTabs a[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
            const packageName = $(e.target).text(); // Get the package name from the tab text
            const tableInstance = tableInstances[packageName];
            if (tableInstance) {
                tableInstance.columns.adjust().draw();
                applyModeToTable(packageName, tableInstance);
            }
        });

        // Trigger a redraw on window resize
        $(window).on('resize', function () {
            Object.values(tableInstances).forEach(tableInstance => {
                tableInstance.columns.adjust().draw();
            });
        });

        $('#editSwitch').change(function () {
            isDevelopment = $(this).is(':checked');
            switchMode(isDevelopment ? 'development' : 'feedback');
            updateSessionPrefix();
        }).change(); // Trigger change to set initial state

        $('#session-name').on('input', function () {
            updateSessionPrefix();
        });

        function updateSessionPrefix() {
            const sessionPrefix = isDevelopment ? 'MINAS-DEV-' : 'MINAS-FS-';
            const sessionNameInput = $('#session-name');
            let sessionName = sessionNameInput.val().trim();
            sessionName = sessionName.replace(/^MINAS-(FS|DEV)-/, '');
            sessionNameInput.val(sessionPrefix + sessionName);
        }

        $('#tableTabsContent').on('input', 'td', function () {
            const uniqueId = $(this).closest('tr').attr('data-unique-id');
            if (!uniqueId) {
                console.error('No uniqueId found for row');
                return;
            }
            editedRows.add(uniqueId);
            $(this).closest('tr').addClass('modified-row');
            $(this).addClass('modified-cell');
        });

        // Show modal form for adding a new row
        $('#add-row').click(function () {
            if (!isDevelopment) {
                showModal('Adding new rows is not allowed in feedback mode.');
                return;
            }
            $('#addRowForm').empty(); // Clear the form
            $('#addRowForm').append(`
                <div class="form-group">
                    <label for="packageSelect">Package</label>
                    <select class="form-control" id="packageSelect">
                        ${Object.keys(tableInstances).map(packageName => `<option value="${packageName}">${packageName}</option>`).join('')}
                    </select>
                </div>
            `);
            columnOrder.forEach(col => {
                if (col !== 'Package') {
                    $('#addRowForm').append(`
                        <div class="form-group">
                            <label for="row${col.replace(/\s+/g, '')}">${col}</label>
                            <textarea class="form-control" id="row${col.replace(/\s+/g, '')}" placeholder="${col}" style="min-height: 40px;"></textarea>
                        </div>`);
                }
            });
            $('#addRowModal').modal('show');
        });

        // Handle saving the new row from the modal form
        $('#saveNewRow').click(function () {
            const selectedPackage = $('#packageSelect').val();
            const tableId = `table-${selectedPackage.replace(/\s+/g, '-')}-table`;
            const dataTable = $(`#${tableId}`).DataTable();

            // Collect data from the form
            const newRowData = {};
            columnOrder.forEach(col => {
                if (col !== 'Package') {
                    newRowData[col] = $(`#row${col.replace(/\s+/g, '')}`).val() || '';
                } else {
                    newRowData[col] = $('#packageSelect').val();
                }
            });

            const uniqueId = `${selectedPackage}-${Date.now()}`; // Unique ID for new rows
            newRowData['RowID'] = uniqueId;

            // Track the new row for export
            newRows.add(uniqueId);
            modifiedData[uniqueId] = {};
            columnOrder.forEach(col => {
                modifiedData[uniqueId][col] = {
                    original: '',
                    modified: newRowData[col]
                };
            });

            // Create the new row
            const newRow = $('<tr>').attr('data-unique-id', uniqueId);
            newRow.append('<td class="select-checkbox sorting_disabled" aria-label="" rowspan="1" colspan="1" style="width: 3px;"><input type="checkbox" class="row-select"></td>'); // Add checkbox column
            columnOrder.forEach(col => {
                const isEditable = isDevelopment || col === 'Comments';
                const cellValue = newRowData[col];
                const cell = $('<td>')
                    .attr('contenteditable', isEditable)
                    .attr('data-original-value', cellValue)
                    .css('max-width', '0px')
                    .text(cellValue);
                newRow.append(cell);
            });

            // Add the unique identifier to the row
            newRow.append(`<td class="d-none row-id">${uniqueId}</td>`);

            // Append the new row to the table body
            $(`#${tableId} tbody`).append(newRow);

            // Add the new row to the DataTable
            dataTable.row.add(newRow).draw();

            // Scroll to the new row if it exists in the DOM
            newRow[0].scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            $('#addRowModal').modal('hide');
            $('#addRowForm')[0].reset(); // Reset the form

            // Trigger redraw to ensure new row is editable
            dataTable.columns.adjust().draw();
        });

        // Button for deleting selected rows
        $('#delete-row').click(function () {
            const selectedRows = $('.tab-pane.active table tbody tr.selected');
            if (selectedRows.length === 0) {
                showModal('No rows selected for deletion.');
                return;
            }
            $('#deleteConfirmModal').modal('show');
        });

        $('#confirmDeleteRow').click(function () {
            const activeTableId = $('.tab-pane.active table').attr('id');
            const dataTable = $(`#${activeTableId}`).DataTable();
            const selectedRows = dataTable.rows('.selected');

            selectedRows.every(function () {
                const rowNode = this.node();
                const uniqueId = $(rowNode).attr('data-unique-id');
                delete modifiedData[uniqueId];
                newRows.delete(uniqueId);
                this.remove();
                return true;
            });

            dataTable.draw(false);
            $('#deleteConfirmModal').modal('hide');
        });

        $('#view-row').click(function () {
            const selectedRows = $('.tab-pane.active table tbody tr.selected');
            console.debug("Number of selected rows: ", selectedRows.length); // Debug statement

            if (selectedRows.length !== 1) {
                showModal('Please select exactly one row to view.');
                return; // Exit the function to prevent showing the modal
            }

            const row = selectedRows.eq(0);
            const uniqueId = row.attr('data-unique-id');
            console.debug("Unique ID of the selected row: ", uniqueId); // Debug statement
            const rowData = getRowData(row, uniqueId);

            $('#viewRowForm').empty();
            columnOrder.forEach((col) => {
                const value = rowData[col];
                const formGroup = `<div class="form-group">
                    <label for="view-${col.replace(/\s+/g, '-')}" class="col-form-label">${col}:</label>
                    <textarea class="form-control" id="view-${col.replace(/\s+/g, '-')}" readonly>${value}</textarea>
                </div>`;
                $('#viewRowForm').append(formGroup);
            });

            $('#viewRowModal').modal('show');
        });

        $('#edit-row').click(function () {
            const selectedRows = $('.tab-pane.active table tbody tr.selected');
            if (selectedRows.length !== 1) {
                showModal('Please select exactly one row to edit.');
                return;
            }
            const row = selectedRows.eq(0);
            const uniqueId = row.attr('data-unique-id');
            const rowData = getRowData(row, uniqueId);

            $('#editRowForm').empty();
            columnOrder.forEach((col, index) => {
                const value = rowData[col];
                const formGroup = `<div class="form-group">
                    <label for="edit-${col.replace(/\s+/g, '-')}" class="col-form-label">${col}:</label>
                    <textarea class="form-control" id="edit-${col.replace(/\s+/g, '-')}" style="min-height: 40px;">${value}</textarea>
                </div>`;
                $('#editRowForm').append(formGroup);
            });

            $('#editRowModal').modal('show');
        });

        $('#saveEditRow').click(function () {
            const selectedRows = $('.tab-pane.active table tbody tr.selected');
            if (selectedRows.length !== 1) {
                showModal('Please select exactly one row to edit.');
                return;
            }
            const row = selectedRows.eq(0);
            const uniqueId = row.attr('data-unique-id');

            columnOrder.forEach((col, index) => {
                const newValue = $(`#edit-${col.replace(/\s+/g, '-')}`).val();
                const cell = row.find(`td:eq(${index + 1})`);
                cell.text(newValue).attr('data-original-value', newValue);

                // Update modifiedData object
                if (!modifiedData[uniqueId]) {
                    modifiedData[uniqueId] = {};
                    // Store original values for the entire row
                    columnOrder.forEach(function (col) {
                        const originalValue = row.find(`td:eq(${columnOrder.indexOf(col) + 1})`).attr('data-original-value') || '';
                        modifiedData[uniqueId][col] = {
                            original: originalValue,
                            modified: originalValue
                        };
                    });
                }

                // Update the modified value if it is different from the original
                if (modifiedData[uniqueId][col].original !== newValue) {
                    modifiedData[uniqueId][col].modified = newValue;
                } else {
                    modifiedData[uniqueId][col].modified = '';
                }

                // Apply modified class
                if (modifiedData[uniqueId][col].original !== newValue) {
                    cell.addClass('modified-cell');
                    row.addClass('modified-row');
                } else {
                    cell.removeClass('modified-cell');
                    if (row.find('.modified-cell').length === 0) {
                        row.removeClass('modified-row');
                    }
                }
            });

            const activeTableId = $('.tab-pane.active table').attr('id');
            const dataTable = $(`#${activeTableId}`).DataTable();
            dataTable.row(row).invalidate().draw(); // Redraw the table to reflect changes
            $('#editRowModal').modal('hide');
        });
    }

    function switchMode(mode) {
        if (mode === 'development') {
            $('#view-row').show();
            $('#edit-row').show();
            $('#add-row').show();
            $('#delete-row').show();
        } else {
            $('#view-row').show();
            $('#edit-row').hide();
            $('#add-row').hide();
            $('#delete-row').hide();
        }

        Object.keys(tableInstances).forEach(packageName => {
            const tableInstance = tableInstances[packageName];
            applyModeToTable(packageName, tableInstance);
        });
    }

    function applyModeToTable(packageName, tableInstance) {
        tableInstance.rows().nodes().each(function (row) {
            $(row).find('td').each(function (index) {
                // Ensure only Comments column is editable in feedback mode
                const isCommentsColumn = columnOrder[index - 1] === 'Comments';
                const isCheckboxColumn = $(this).hasClass('select-checkbox');
                const isEditable = (isDevelopment || isCommentsColumn) && !isCheckboxColumn;
                $(this).attr('contenteditable', isEditable);
            });
        });
    }

    function getRowData(row, uniqueId) {
        const rowData = {};
        columnOrder.forEach((col, index) => {
            const cell = row.find(`td:eq(${index + 1})`);
            const originalValue = cell.attr('data-original-value');
            const modifiedValue = modifiedData[uniqueId] && modifiedData[uniqueId][col] ? modifiedData[uniqueId][col].modified : originalValue;
            rowData[col] = modifiedValue || originalValue;
        });
        return rowData;
    }

    $('#session-name').on('input', function () {
        const sessionPrefix = isDevelopment ? 'MINAS-DEV-' : 'MINAS-FS-';
        if (!$(this).val().startsWith(sessionPrefix)) {
            $(this).val(sessionPrefix + $(this).val().replace(/^MINAS-(FS|DEV)-/, ''));
        }
    });

    $('#save-table').click(function () {
        // Trigger a redraw on all tables to ensure any unrecorded modifications are captured
        Object.values(tableInstances).forEach(tableInstance => {
            tableInstance.columns.adjust().draw();
        });

        const modifiedRows = collectAllRowsData();
        const additionalInfo = [];
        let sessionName = $('#session-name').val().trim();
        let emailError = false;
        const sessionPrefix = isDevelopment ? 'MINAS-DEV-' : 'MINAS-FS-';
        sessionName = sessionName.replace(/^MINAS-(FS|DEV)-/, '');

        if (!sessionName) {
            showModal('Session name is required.');
            return;
        }

        $('.additional-fields .field-group').each(function () {
            const name = $(this).find('.name-field').val().trim();
            const email = $(this).find('.email-field').val().trim();
            if (name && email && validateEmail(email)) {
                additionalInfo.push({
                    name,
                    email
                });
            } else if (name || email) {
                emailError = true;
                return false; // Break out of the loop
            }
        });

        if (additionalInfo.length === 0) {
            showModal('At least one valid name and email is required.');
            return;
        }

        if (modifiedRows.length === 0) {
            showModal('No modifications or new rows detected. Please make some changes before saving.');
        } else if (emailError) {
            showModal('Please enter valid email addresses.');
        } else {
            const timestamp = new Date().toISOString().replace(/:/g, '_');
            const jsonData = JSON.stringify({
                modifiedRows,
                miscellaneous: {
                    sessionName: sessionPrefix + sessionName,
                    sessionType: isDevelopment ? 'development' : 'feedback',
                    additionalInfo,
                    timestamp
                }
            }, null, 2);
            const fileName = `${submissionTitle}__${sessionPrefix}${sessionName}__${timestamp}.json`;
            const blob = new Blob([jsonData], {
                type: 'application/json;charset=utf-8'
            });
            saveAs(blob, fileName);
        }
    });

    // Function to collect all rows data
    function collectAllRowsData() {
        const allRows = [];
        Object.keys(tableInstances).forEach(packageName => {
            const dataTable = tableInstances[packageName];
            dataTable.rows().every(function () {
                const row = this.node();
                const uniqueId = $(row).attr('data-unique-id');
                const rowData = {};
                let isModified = false;
                columnOrder.forEach(colName => {
                    const original = $(row).find(`td:eq(${columnOrder.indexOf(colName) + 1})`).attr('data-original-value') || '';
                    const modified = modifiedData[uniqueId] && modifiedData[uniqueId][colName] ? modifiedData[uniqueId][colName].modified : original;
                    rowData[colName] = {
                        original: original,
                        modified: modified !== original ? modified : ''
                    };
                    if (modified !== original) {
                        isModified = true;
                    }
                });
                allRows.push(rowData);
            });
        });
        return allRows;
    }

    // Add functionality to add new fields
    $(document).on('click', '.add-field', function () {
        const fieldGroup = `
    <div class="field-group">
        <input type="text" placeholder="Name" class="form-control name-field input-field">
        <input type="email" placeholder="Email" class="form-control email-field input-field">
        <button class="btn btn-danger remove-field">-</button>
    </div>`;
        $(this).closest('.field-group').after(fieldGroup);
    });

    // Add functionality to remove fields
    $(document).on('click', '.remove-field', function () {
        $(this).closest('.field-group').remove();
    });

    // Real-time email validation
    $(document).on('input', '.email-field', function () {
        const email = $(this).val();
        if (validateEmail(email)) {
            $(this).removeClass('invalid-email');
        } else {
            $(this).addClass('invalid-email');
        }
    });

    function validateEmail(email) {
        const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        return re.test(String(email).toLowerCase());
    }

    function showModal(message) {
        $('#errorModalMessage').text(message);
        $('#errorModal').modal('show');
    }

    // Back to top button functionality
    const backToTopButton = $('#back-to-top');
    $(window).scroll(function () {
        if ($(window).scrollTop() > 300) {
            backToTopButton.fadeIn();
        } else {
            backToTopButton.fadeOut();
        }
    });

    backToTopButton.click(function () {
        $('html, body').animate({
            scrollTop: 0
        }, '300');
    });

    // Handle select all checkbox
    $(document).on('change', '#select-all', function () {
        const isChecked = $(this).is(':checked');
        $('.row-select').prop('checked', isChecked);
        if (isChecked) {
            $('tr').addClass('selected');
        } else {
            $('tr').removeClass('selected');
        }
    });

    // Handle individual row checkbox
    $(document).on('change', '.row-select', function () {
        const row = $(this).closest('tr');
        row.toggleClass('selected', $(this).is(':checked'));
    });
    let currentCell = null;

    // Show bubble editor on cell click
    $('body').on('click', 'td[contenteditable="true"]', function () {
        const $cell = $(this);
        currentCell = $cell;

        const originalText = $cell.text();
        const bubble = $('<div contenteditable="true" class="bubble-editor">' + originalText + '</div>');
        $('body').append(bubble);
        bubble.css({
            top: $cell.offset().top,
            left: $cell.offset().left,
            width: '300px'
        }).focus();

        bubble.on('focusout', function () {
            const newValue = bubble.text();
            const originalValue = $cell.attr('data-original-value');

            if (!originalValue) {
                $cell.attr('data-original-value', originalText);
            }

            $cell.text(newValue);
            bubble.remove();

            const uniqueId = $cell.closest('tr').attr('data-unique-id');
            const cellIndex = $cell.index();
            const colName = columnOrder[cellIndex - 1];

            if (!uniqueId) {
                console.error('No uniqueId found for row');
                return;
            }

            if (!modifiedData[uniqueId]) {
                modifiedData[uniqueId] = {};
                columnOrder.forEach(function (col) {
                    const originalValue = $cell.closest('tr').find(`td:eq(${columnOrder.indexOf(col) + 1})`).attr('data-original-value') || '';
                    modifiedData[uniqueId][col] = {
                        original: originalValue,
                        modified: originalValue
                    };
                });
            }

            if (modifiedData[uniqueId][colName].original !== newValue) {
                modifiedData[uniqueId][colName].modified = newValue;
            } else {
                modifiedData[uniqueId][colName].modified = '';
            }

            if (modifiedData[uniqueId][colName].original !== newValue) {
                $cell.addClass('modified-cell');
                $cell.closest('tr').addClass('modified-row');
            } else {
                $cell.removeClass('modified-cell');
                if ($cell.closest('tr').find('.modified-cell').length === 0) {
                    $cell.closest('tr').removeClass('modified-row');
                }
            }

            // Assuming dataTable is available in the scope
            const activeTableId = $cell.closest('table').attr('id');
            console.log(activeTableId);

            const dataTable = $(`#${activeTableId}`).DataTable(); // Adjust selector as per your table's id
            console.log(dataTable);
            const cellIndexDataTable = dataTable.cell($cell).index();

            if (cellIndexDataTable !== undefined) {
                dataTable.cell(cellIndexDataTable).data(newValue).draw(false);

                $cell.addClass('highlighted-cell');
                setTimeout(() => {
                    $cell[0].scrollIntoView({ behavior: "smooth", block: "center" });
                    setTimeout(() => $cell.removeClass('highlighted-cell'), 2000);
                }, 0);
            } else {
                console.error('Failed to get the DataTable cell index for', $cell);
            }
        });
    });


    // Function to update cell value
    function updateCellValue($cell, newValue, uniqueId, colName) {
        const originalValue = $cell.attr('data-original-value');

        // Initialize modifiedData for the row if it doesn't exist
        if (!modifiedData[uniqueId]) {
            modifiedData[uniqueId] = {};
        }

        // Store the original value if not already stored
        if (!modifiedData[uniqueId][colName]) {
            modifiedData[uniqueId][colName] = {
                original: originalValue,
                modified: originalValue
            };
        }

        // Update the modified value
        if (originalValue !== newValue) {
            modifiedData[uniqueId][colName].modified = newValue;
            $cell.addClass('modified-cell');
            $cell.closest('tr').addClass('modified-row');
        } else {
            $cell.removeClass('modified-cell');
            if ($cell.closest('tr').find('.modified-cell').length === 0) {
                $cell.closest('tr').removeClass('modified-row');
            }
            modifiedData[uniqueId][colName].modified = '';
        }
    }

});
