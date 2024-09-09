import { parse } from "node-html-parser";
import axios from "axios";
import fs from "fs";
import shell from "shelljs";

const path = "./scripts";

// Gathers needed git commands for bash to execute per provided contribution data.
const getCommand = (contribution) => {
	return `GIT_AUTHOR_DATE=${contribution.date}T12:00:00 GIT_COMMITER_DATE=${contribution.date}T12:00:00 git commit --allow-empty -m "Rewriting History!" > /dev/null\n`.repeat(
		contribution.count
	);
};

const getRandomFilter = (contribution, year, month) => {
	const { date, count } = contribution;

	if (!date) return false;

	if (count <= 0) return false;

	if (!date.startsWith(`${year}-${month.toString().padStart(2, "0")}`))
		return false;

	const day = new Date(date).getDay();
	if (day === 5 || day === 6) {
		return Math.random() < 0.2;
	}

	return true;
};

const getDays = (year, month) => {
	const days = [
		31,
		year % 4 === 0 ? 29 : 28,
		31,
		30,
		31,
		30,
		31,
		31,
		30,
		31,
		30,
		31,
	];
	return days[month - 1];
};

const createScripts = async (username, excute, year, month) => {
	// Returns contribution graph html for a full selected year.
	const res = await axios.get(
		`https://github.com/users/${username}/contributions?tab=overview&from=${year}-12-01&to=${year}-12-31`
	);

	// Retrieves needed data from the html, loops over green squares with 1+ contributions,
	// and produces a multi-line string that can be run as a bash command.
	const script = parse(res.data)
		.querySelectorAll("[data-level]")
		.map((el) => {
			return {
				date: el.attributes["data-date"],
				count: parseInt(el.attributes["data-level"]),
			};
		})
		.filter((contribution) => getRandomFilter(contribution, year, month))
		.sort((prev, next) => prev.date.localeCompare(next.date))
		.map((contribution) => getCommand(contribution))
		.join("")
		.concat("git pull origin main\n", "git push -f origin main");

	const filename = `${path}/${year}-${month.toString().padStart(2, "0")}.sh`;
	fs.writeFileSync(filename, script);
	console.log(filename);
	if (excute) shell.exec(`sh ${filename}`);
};

export default async (input) => {
	let start_year = parseInt(input.start_year_month.split("-")[0]);
	let start_month = parseInt(input.start_year_month.split("-")[1]) || 1;
	let end_year = parseInt(input.end_year_month.split("-")[0]);
	let end_month = parseInt(input.end_year_month.split("-")[1]) || 12;

	if (start_year > end_year) return;
	else if (start_year === end_year && start_month > end_month) return;
	else {
		fs.exists(path, (exists) => {
			if (!exists) fs.mkdirSync(path, true);
		});

		let next_year;
		let next_month;
		if (end_month === 12) {
			next_year = end_year + 1;
			next_month = 1;
		} else {
			next_year = end_year;
			next_month = end_month + 1;
		}

		while (start_year !== next_year || start_month !== next_month) {
			await createScripts(
				input.username,
				input.excute,
				start_year,
				start_month
			);

			if (start_month === 12) {
				start_year++;
				start_month = 1;
			} else {
				start_month++;
			}
		}
	}
};
