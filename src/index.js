import { parse } from "node-html-parser";
import axios from "axios";
import fs from "fs";
import shell from "shelljs";

// Gathers needed git commands for bash to execute per provided contribution data.
const getCommand = (contribution) => {
  return `GIT_AUTHOR_DATE=${contribution.date}T12:00:00 GIT_COMMITER_DATE=${contribution.date}T12:00:00 git commit --allow-empty -m "Rewriting History!" > /dev/null\n`.repeat(
    contribution.count
  );
};

export default async (input) => {
  // Returns contribution graph html for a full selected year.
  const res = await axios.get(
    `https://github.com/users/${input.username}/contributions?tab=overview&from=${input.year}-12-01&to=${input.year}-12-31`
  );

  // Retrieves needed data from the html, loops over green squares with 1+ contributions,
  // and produces a multi-line string that can be run as a bash command.
  const data = parse(res.data).querySelectorAll("[data-count]").map((el) => {
    return {
      date: el.attributes["data-date"],
      count: parseInt(el.attributes["data-count"]),
    };
  })
    .filter((contribution) => contribution.count > 0);

  let months = new Array(12).fill([]);
  for (let i = 0; i < 12; i++) months[i] = [];
  data.forEach(each => {
    months[new Date(each.date).getUTCMonth()].push(each);
  });

  const path = "./scripts"
  fs.exists(path, exists => {
    if (!exists) fs.mkdirSync(path, true);

    months.forEach((month, index) => {
      const script = month.map((contribution) => getCommand(contribution)).join("")
      .concat("git pull origin main\n", "git push -f origin main");
      
      fs.writeFile(`${path}/script_${input.year}_${index + 1}.sh`, script, () => {
        console.log(`${input.year}-${index + 1} was created successfully.`);

        if (input.execute) {
          console.log("This might take a moment!\n");
          shell.exec(`sh ${path}/script_${input.year}_${index + 1}.sh`);
        }
      });
    });
  });
};
