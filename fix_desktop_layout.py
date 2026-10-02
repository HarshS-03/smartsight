with open(r's:\smartsight\desktop\src\pages\ReportsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix radio button styling
content = content.replace(
    '''<div className="d-flex align-items-center gap-2 mb-3 bg-inner-card p-1 rounded-pill w-100" style={{ maxWidth: '100%', overflowX: 'auto' }}>''',
    '''<div className="d-inline-flex align-items-center gap-2 mb-3 bg-inner-card p-1 rounded-pill" style={{ minWidth: '400px', overflowX: 'auto' }}>'''
)

# Fix flex layout to row
content = content.replace(
    '''              <div
                className="custom-scrollbar pe-1"
                style={{ maxHeight: '380px', overflowY: 'auto' }}
              >
                <div className="d-flex flex-column gap-3">''',
    '''              <div
                className="custom-scrollbar pe-1"
                style={{ maxHeight: '380px', overflowY: 'auto', overflowX: 'hidden' }}
              >
                <div className="row g-3">'''
)

# Fix item mapping to add col wrapper and h-100
content = content.replace(
    '''                      return visiblePersons.map((person, index) => (
                        <div
                          key={index}
                          className="d-flex align-items-center gap-3 p-3 rounded-4 shadow-sm cursor-pointer hover-bg-subtle"
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',''',
    '''                      return visiblePersons.map((person, index) => (
                        <div className="col-12 col-lg-6 col-xl-4" key={index}>
                        <div
                          className="d-flex align-items-center gap-3 p-3 rounded-4 shadow-sm cursor-pointer hover-bg-subtle h-100"
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)','''
)

# Close the new div
content = content.replace(
    '''                        </div>
                      </div>
                    </div>
                  ));''',
    '''                        </div>
                      </div>
                    </div>
                    </div>
                  ));'''
)


with open(r's:\smartsight\desktop\src\pages\ReportsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated desktop layout!")
