// Global Variables (Keep these as they are)
const betterInput = document.getElementById("betters");
const addButton = document.getElementById("btn");
const betterTable = document.getElementById("table-betters");
const betterSelect = document.getElementById("better-select");
const betInput = document.getElementById("bet-amount");
const betBtn = document.getElementById("place-bet");
const golferSelect = document.getElementById("golfer-select");


const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxDwo6v2gt4OrDLE4RQp8cbygBoRJ8QWfX-2-gkLvo1gNCPuNmd9IPIawDDLxkEvdcl_A/exec";

// --- START: Helper Functions ---

// This function is no longer used for the matrix table, so it should be removed 
// or replaced with logic that reloads the entire matrix.

// Helper function to handle sending data to Google Sheets via fetch (avoids repetition)
function sendToGoogleSheets(dataPayload) {
    fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(dataPayload)
    })
        .then(() => {
            console.log("Data sent to Google Sheets!");
            // Optional: Reload the whole table to see the new totals after sending a bet
            // window.onload(); 
        })
        .catch(error => console.error("Error sending data:", error));
}

function loadMatrixTableFromSheet() {
    fetch(SCRIPT_URL)
        .then(response => response.json())
        .then(data => {
            const table = document.getElementById("table-betters");
            table.innerHTML = "";

            // --- 1. RESET SELECT DROPDOWNS ---
            betterSelect.innerHTML = '<option value="">-- Select a Name --</option>';
            golferSelect.innerHTML = '<option value="">-- Pick a Golfer --</option>';

            // --- HIGHLIGHT TRACKING ---
            let maxPayout = 0;
            let payoutCells = [];

            // 2. Headers (Golfers)
            const matrixHeaders = data.matrix[0];
            const headers = [...matrixHeaders, "Better Total"];
            const headerRow = table.insertRow(0);

            headers.forEach((text, index) => {
                const th = document.createElement("th");
                th.textContent = text;
                headerRow.appendChild(th);

                // --- 3. POPULATE GOLFER SELECT ---
                // Skip the first header (Better Name label) and the last (Total label)
                if (index > 0 && index < matrixHeaders.length) {
                    golferSelect.add(new Option(text, text));
                }
            });

            // 4. Body Rows
            const matrix = data.matrix;
            const bTotals = data.betterTotals;

            for (let i = 1; i < matrix.length; i++) {
                const rowData = matrix[i];
                if (!rowData[0] || rowData[0].toString().trim() === "") continue;

                const newRow = table.insertRow(-1);

                // Better Name (Column 1)
                const betterName = rowData[0];
                const nameTh = document.createElement("th");
                nameTh.textContent = betterName;
                newRow.appendChild(nameTh);

                // --- 5. POPULATE BETTER SELECT ---
                betterSelect.add(new Option(betterName, betterName.toLowerCase()));

                // Payouts
                for (let j = 1; j < rowData.length; j++) {
                    const td = newRow.insertCell(-1);
                    const val = parseFloat(rowData[j]) || 0;

                    if (val > maxPayout) maxPayout = val;
                    payoutCells.push({ element: td, value: val });

                    td.textContent = formatCurrency(val);
                }

                // Better Total
                const totalTh = document.createElement("th");
                totalTh.textContent = formatCurrency(bTotals[i-1]);
                newRow.appendChild(totalTh);
            }

            // 6. Footer (Golfer Totals)
            const footer = table.createTFoot();
            const fRow = footer.insertRow(0);
            const label = document.createElement("th");
            label.textContent = "Golfer Totals";
            fRow.appendChild(label);

            data.golferTotals.forEach(total => {
                const th = document.createElement("th");
                th.textContent = formatCurrency(total);
                fRow.appendChild(th);
            });

            // --- 7. UPDATE TOTAL SPENT (With Safety Check) ---
            const totSpentDisplay = document.getElementById("totSpent");
            if (totSpentDisplay) {
                totSpentDisplay.textContent = `Total Pool: ${formatCurrency(data.totalSpent)}`;
            }


            // --- 8. APPLY THE HIGHLIGHTS ---
            if (maxPayout > 0) {
                payoutCells.forEach(item => {
                    // Remove any old classes first (good practice for reloads)
                    item.element.classList.remove("entered", "high-payout", "winner-cell");

                    // Use the raw number (item.value) for the check
                    if (item.value > 0) {
                        item.element.classList.add("entered");

                        // Now check for specialized highlights
                        if (item.value === maxPayout) {
                            item.element.classList.add("winner-cell");
                        } else if (item.value > (maxPayout * 0.5)) {
                            item.element.classList.add("high-payout");
                        }
                    }
                });
            }

        })
        .catch(error => console.error("Error loading matrix data:", error));
}


// 6. Helper: Restores professional rounding & currency
function formatCurrency(val) {
    let numValue = parseFloat(val.toString().replace('$', '').replace(',', '')) || 0;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
        minimumFractionDigits: 0
    }).format(numValue);
}


// Helper function to find the column index by the header name
function findGolferColumnIndex(golferName) {
    const headerRow = betterTable.rows[0]; // Get the very first row
    const headers = headerRow.cells;

    // Loop through headers (start at 1 to skip "Better Name" column)
    for (let i = 1; i < headers.length; i++) {
        if (headers[i].textContent === golferName) {
            return i; // Return the exact column index
        }
    }
    return -1; // Golfer name not found
}


addButton.addEventListener("click", function () {
    const name = betterInput.value.trim();
    if (name === "") return alert("Please enter a name.");

    // --- DUPLICATE CHECK START ---
    let isDuplicate = false;
    for (let i = 1; i < betterTable.rows.length; i++) {
        // Checking the first cell (index 0) of each row
        const existingName = betterTable.rows[i].cells[0].textContent;
        if (existingName.toLowerCase() === name.toLowerCase()) {
            isDuplicate = true;
            break;
        }
    }

    if (isDuplicate) {
        alert("This better is already registered!");
        betterInput.value = "";
        return;
    }
    // --- DUPLICATE CHECK END ---

    const dataPayload = { name: name, bet: "$0" };
    sendToGoogleSheets(dataPayload);

    betterInput.value = "";

    // Refresh table after a short delay to allow Google Sheets to process
    setTimeout(loadMatrixTableFromSheet, 1500);
});




// PLACE BET BUTTON LISTENER (Transaction: Sends to Sheet2 via doPost with 'type: betUpdate')
// Helper function to find the column index by the header name
function findGolferColumnIndex(golferName) {
    const headerRow = betterTable.rows[0]; // Get the very first row
    const headers = headerRow.cells;

    // Loop through headers (start at 1 to skip "Better Name" column)
    for (let i = 1; i < headers.length; i++) {
        if (headers[i].textContent === golferName) {
            return i; // Return the exact column index
        }
    }
    return -1; // Golfer name not found
}

// Update your betBtn listener to use this helper:
betBtn.addEventListener("click", function () {
    const selectedName = betterSelect.value;
    const amountToAdd = parseFloat(betInput.value);
    const selectedGolfer = golferSelect.value;
    const confirmselectedName = betterSelect.options[betterSelect.selectedIndex].text;
    

    if (!selectedName || !selectedGolfer || isNaN(amountToAdd) || amountToAdd <= 0) {
        return alert("Please fill out all bet details correctly.");
    }

    const columnIndex = findGolferColumnIndex(selectedGolfer); // Find the correct index

    if (columnIndex === -1) {
        return alert("Could not find selected golfer in the table!");
    }

    const confirmationMessage = `Are you sure you want to bet $${amountToAdd} on ${selectedGolfer} for ${confirmselectedName}?`;

    if (confirm(confirmationMessage)) {

        // 1. Update the correct local table cell
        for (let i = 1; i < betterTable.rows.length; i++) {
            const row = betterTable.rows[i];

            // 1. Ensure the row and its first cell exist
            if (!row || !row.cells || row.cells.length === 0) continue;

            const firstCell = row.cells[0];

            // 2. Ensure the first cell has text content
            if (firstCell && firstCell.textContent) {
                const rowName = firstCell.textContent.trim();

                // 3. Only run toLowerCase if rowName is NOT empty
                if (rowName && rowName.toLowerCase() === selectedName.toLowerCase()) {

                    // Find the specific payout cell using the columnIndex
                    const betCell = row.cells[columnIndex];

                    if (betCell) {
                        const currentTotal = parseFloat(betCell.textContent.replace('$', '')) || 0;
                        const newTotal = currentTotal + amountToAdd;

                        // Format the updated total back as currency
                        betCell.textContent = new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            maximumFractionDigits: 0,
                            minimumFractionDigits: 0
                        }).format(newTotal);

                        break; // Stop searching once the match is found
                    }
                }
            }
        }

        // 2. Send to Google Sheets (Transaction)
        const betData = {
            type: "betUpdate",
            name: selectedName,
            amount: amountToAdd,
            golfer: selectedGolfer
        };

        sendToGoogleSheets(betData);

        betInput.value = "";
        golferSelect.selectedIndex = 0;
    }
    setTimeout(loadMatrixTableFromSheet, 3000);



});

// --- END: Event Listeners ---
