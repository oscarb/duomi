export interface ExpenseItem {
	id: number;
	name: string;
	paidBy: 'A' | 'B';
	splitType: 'dynamic' | 'static';
	staticSplitRatio: number | null; // A's share if static, between 0.0 and 1.0
	amount: number; // Stored in whole currency units
}

export function calculateSettlement(incomeA: number, incomeB: number, expenses: ExpenseItem[]) {
	const totalIncome = incomeA + incomeB;
	let ratioA = 0.5;
	let ratioB = 0.5;

	if (totalIncome > 0) {
		ratioA = incomeA / totalIncome;
		ratioB = incomeB / totalIncome;
	}

	let totalOwedByAToB = 0;
	let totalOwedByBToA = 0;

	for (const expense of expenses) {
		let shareA = 0;
		let shareB = 0;

		if (expense.splitType === 'static') {
			const staticRatio = expense.staticSplitRatio ?? 0.5;
			shareA = expense.amount * staticRatio;
			shareB = expense.amount * (1 - staticRatio);
		} else {
			shareA = expense.amount * ratioA;
			shareB = expense.amount * ratioB;
		}

		if (expense.paidBy === 'A') {
			// A paid, so B owes A B's share
			totalOwedByBToA += shareB;
		} else {
			// B paid, so A owes B A's share
			totalOwedByAToB += shareA;
		}
	}

	let payer: 'A' | 'B' | null = null;
	let amount = 0;

	if (totalOwedByBToA > totalOwedByAToB) {
		payer = 'B';
		amount = totalOwedByBToA - totalOwedByAToB;
	} else if (totalOwedByAToB > totalOwedByBToA) {
		payer = 'A';
		amount = totalOwedByAToB - totalOwedByBToA;
	}

	// Round to 2 decimal places to handle currency decimals in final splits
	amount = Math.round(amount * 100) / 100;

	return {
		payer,
		amount,
		ratioA: Math.round(ratioA * 100) / 100,
		ratioB: Math.round(ratioB * 100) / 100
	};
}
