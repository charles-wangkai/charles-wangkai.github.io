import html
import json
from selenium import webdriver
from selenium.webdriver.common.by import By


driver = webdriver.Firefox()
driver.implicitly_wait(10)


def crawl_years():
    years = []

    driver.get("https://codingcompetitions.withgoogle.com/kickstart/archive")
    for elem in driver.find_elements(By.XPATH, "//a[contains(@class, 'card-row-cell')]"):
        prefix = 'archive-card-'
        id = elem.get_attribute('id')
        if id.startswith(prefix):
            years.append({
                'name': id[len(prefix):],
                'url': elem.get_attribute('href')
            })

    return years


def regulate_round_name(year_name, words):
    return words[:-1] if words[-1] == year_name else words


def crawl_rounds(year):
    rounds = []

    driver.get(year['url'])
    for elem in driver.find_elements(By.XPATH, "//div[contains(@class, 'schedule-row') and @role='row']"):
        rounds.append({
            'name': ' '.join(regulate_round_name(year['name'], elem.find_element(By.XPATH, './/span').text.split(' '))),
            'url': elem.find_element(By.XPATH, './/a').get_attribute('href')
        })

    return rounds


def crawl_problems(round_url):
    problems = []

    driver.get(round_url)
    for elem in driver.find_elements(By.XPATH, "//div[contains(@class, 'problems-nav-selector-item-container')]"):
        problems.append({
            'name': html.unescape(elem.find_element(By.XPATH, ".//p").get_attribute('innerHTML').strip()),
            'url': elem.find_element(By.XPATH, './/a').get_attribute('href')
        })

    return problems


def main():
    dataset = {
        'years': crawl_years()
    }

    for year in dataset['years']:
        year['rounds'] = crawl_rounds(year)

        for round in year['rounds']:
            round['problems'] = crawl_problems(round['url'])

    with open('kickstart_dataset.json', 'w') as f:
        json.dump(dataset, f, indent=4)

    driver.close()


if __name__ == "__main__":
    main()
