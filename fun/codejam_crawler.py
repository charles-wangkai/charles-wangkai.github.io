import json
from selenium import webdriver


driver = webdriver.Firefox()
driver.implicitly_wait(10)


def crawl_years():
    years = []

    driver.get("https://codingcompetitions.withgoogle.com/codejam/archive")
    for elem in driver.find_elements_by_xpath("//a[contains(@class, 'card-row-cell')]"):
        prefix = 'archive-card-'
        id = elem.get_attribute('id')
        if id.startswith(prefix):
            years.append({
                'name': int(id[len(prefix):]),
                'url': elem.get_attribute('href')
            })

    return years


def crawl_rounds(year_url):
    rounds = []

    driver.get(year_url)
    for elem in driver.find_elements_by_xpath("//div[contains(@class, 'schedule-row') and @role='row']"):
        rounds.append({
            'name': ' '.join(elem.find_element_by_xpath('.//span').text.split(' ')[:-1]),
            'url': elem.find_element_by_xpath('.//a').get_attribute('href')
        })

    return rounds


def crawl_problems(round_url):
    problems = []

    driver.get(round_url)
    for elem in driver.find_elements_by_xpath("//div[contains(@class, 'problems-nav-selector-item-container')]"):
        problems.append({
            'name': elem.find_element_by_xpath(".//p").get_attribute('innerHTML').strip(),
            'url': elem.find_element_by_xpath('.//a').get_attribute('href')
        })

    return problems


def main():
    dataset = {
        'years': crawl_years()
    }

    for year in dataset['years']:
        year['rounds'] = crawl_rounds(year['url'])

        for round in year['rounds']:
            round['problems'] = crawl_problems(round['url'])

    with open('codejam_dataset.json', 'w') as f:
        json.dump(dataset, f, indent=4)

    driver.close()


if __name__ == "__main__":
    main()
